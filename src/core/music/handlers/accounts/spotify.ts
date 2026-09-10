import crypto from 'crypto';
import discord from 'discord.js';
import axios, { AxiosError } from 'axios';

import { ConfigManager } from '../../../../utils/config';
import { PlaylistItem, PlaylistResponse, SpotifyTokens, SpotifyPlaylistsResponse } from '../../../../types';
import UserAccount from '../../../../events/database/schema/account_user';

const configManager = ConfigManager.getInstance();

const formatSpotifyError = (error: unknown): string => {
	const axiosError = error as AxiosError<{ error?: { status?: number; message?: string } | string; error_description?: string }>;
	if (!axiosError?.isAxiosError) return `${error}`;
	const status = axiosError.response?.status;
	const body = axiosError.response?.data;
	const reason = typeof body?.error === 'string' ? body.error_description || body.error : body?.error?.message;
	return `${status ?? 'no response'}${reason ? ` - ${reason}` : ` - ${axiosError.message}`}`;
};

export class SpotifyManager {
	private client: discord.Client;
	private static readonly STATE_TTL_MS = 10 * 60 * 1000;

	constructor(client: discord.Client) {
		this.client = client;
	}

	private static signState = (payload: string): string => crypto.createHmac('sha256', configManager.getSpotifyClientSecret()).update(payload).digest('base64url');

	static generateAuthUrl = (userId: string): string => {
		const payload = Buffer.from(`${userId}:${Date.now() + this.STATE_TTL_MS}:${crypto.randomBytes(8).toString('hex')}`).toString('base64url');
		const state = `${payload}.${this.signState(payload)}`;

		const params = new URLSearchParams({ client_id: configManager.getSpotifyClientId(), response_type: 'code', redirect_uri: configManager.getSpotifyRedirectUri(), state, scope: 'playlist-read-private playlist-read-collaborative' });
		return `https://accounts.spotify.com/authorize?${params.toString()}`;
	};

	static validateState = (state: string): string | null => {
		if (typeof state !== 'string' || !state) return null;

		const separator = state.lastIndexOf('.');
		if (separator <= 0) return null;

		const payload = state.slice(0, separator);
		const provided = Buffer.from(state.slice(separator + 1));
		const expected = Buffer.from(this.signState(payload));
		if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

		const [userId, expiresAt] = Buffer.from(payload, 'base64url').toString().split(':');
		if (!userId || !expiresAt) return null;
		if (Date.now() > Number(expiresAt)) return null;

		return userId;
	};

	private makeRequest = async <T>(url: string, tokens: SpotifyTokens, userId: string, options: Record<string, unknown> = {}): Promise<T> => {
		try {
			const response = await axios({ url, headers: { Authorization: `Bearer ${tokens.access}` }, ...options });
			return response.data as T;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 401) {
				const newTokens = await this.refreshTokens(tokens.refresh, userId);
				if (!newTokens) throw error;
				const retryResponse = await axios({ url, headers: { Authorization: `Bearer ${newTokens.access}` }, ...options });
				return retryResponse.data as T;
			}
			throw error;
		}
	};

	private refreshTokens = async (refreshToken: string, userId: string): Promise<{ access: string; refresh: string } | null> => {
		try {
			const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64')}` } });
			const newTokens = { access: response.data.access_token, refresh: response.data.refresh_token || refreshToken };
			await this.saveAccount(userId, newTokens);
			return newTokens;
		} catch (error) {
			this.client.logger.error(`Failed to refresh token: ${formatSpotifyError(error)}`);
			return null;
		}
	};

	exchangeCodeForTokens = async (code: string): Promise<{ access: string; refresh: string } | null> => {
		try {
			const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: configManager.getSpotifyRedirectUri() }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64')}` } });
			return { access: response.data.access_token, refresh: response.data.refresh_token };
		} catch (error) {
			this.client.logger.error(`Error exchanging code for tokens: ${formatSpotifyError(error)}`);
			return null;
		}
	};

	saveAccount = async (userId: string, tokens: { access: string; refresh: string }, username?: string): Promise<boolean> => {
		try {
			await UserAccount.findOneAndUpdate({ userId }, { $set: { 'accounts.$[elem]': { type: 'spotify', token: tokens, username } } }, { arrayFilters: [{ 'elem.type': 'spotify' }], upsert: false });
			const updated = await UserAccount.findOne({ userId, 'accounts.type': 'spotify' });
			if (!updated) await UserAccount.findOneAndUpdate({ userId }, { $push: { accounts: { type: 'spotify', token: tokens, username } } }, { upsert: true });
			return true;
		} catch (error) {
			this.client.logger.error(`Error saving account: ${error}`);
			return false;
		}
	};

	getAccount = async (userId: string): Promise<SpotifyTokens | null> => {
		try {
			const userAccount = await UserAccount.findOne({ userId });
			if (!userAccount) return null;
			const spotifyAccount = userAccount.accounts.find((acc) => acc.type === 'spotify');
			if (!spotifyAccount?.token) return null;
			return { access: spotifyAccount.token.access, refresh: spotifyAccount.token.refresh };
		} catch (error) {
			this.client.logger.error(`Error getting account: ${error}`);
			return null;
		}
	};

	removeAccount = async (userId: string): Promise<boolean> => {
		try {
			await UserAccount.findOneAndUpdate({ userId }, { $pull: { accounts: { type: 'spotify' } } });
			return true;
		} catch (error) {
			this.client.logger.error(`Error removing account: ${error}`);
			return false;
		}
	};

	getSpotifyUsername = async (tokens: SpotifyTokens, userId: string): Promise<string | null> => {
		try {
			const data = await this.makeRequest<{ display_name?: string; id?: string }>('https://api.spotify.com/v1/me', tokens, userId);
			return data.display_name || data.id || null;
		} catch (error) {
			this.client.logger.error(`Error getting Spotify username: ${formatSpotifyError(error)}`);
			return null;
		}
	};

	getSpotifyId = async (tokens: SpotifyTokens, userId: string): Promise<string | null> => {
		try {
			const data = await this.makeRequest<{ id?: string }>('https://api.spotify.com/v1/me', tokens, userId);
			return data.id || null;
		} catch (error) {
			this.client.logger.error(`Error getting Spotify ID: ${formatSpotifyError(error)}`);
			return null;
		}
	};

	getPlaylists = async (userId: string, offset: number = 0, limit: number = 10): Promise<PlaylistResponse | null> => {
		try {
			const tokens = await this.getAccount(userId);
			if (!tokens) return null;
			const data = await this.makeRequest<SpotifyPlaylistsResponse>('https://api.spotify.com/v1/me/playlists', tokens, userId, { params: { limit, offset } });
			const spotifyId = await this.getSpotifyId(tokens, userId);
			if (!spotifyId) return null;
			const owned = (data.items || []).filter((playlist) => playlist.owner?.id === spotifyId);
			const playlists: PlaylistItem[] = owned.map((playlist) => ({ name: `${playlist.name} - Spotify`, value: playlist.external_urls.spotify }));
			return { playlists, hasMore: data.next !== null, nextOffset: offset + limit };
		} catch (error) {
			this.client.logger.error(`Error getting playlists: [${userId}] ${formatSpotifyError(error)}`);
			return null;
		}
	};
}
