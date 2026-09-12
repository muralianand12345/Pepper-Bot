import crypto from 'crypto';
import discord from 'discord.js';
import axios, { AxiosError } from 'axios';

import { ConfigManager } from '../../../../utils/config';
import { PlaylistItem, PlaylistResponse, SpotifyTokens, SpotifyPlaylistItem, SpotifyPlaylistsResponse } from '../../../../types';
import { getAppToken } from './app_token';
import UserAccount from '../../../../events/database/schema/account_user';

const configManager = ConfigManager.getInstance();

type SpotifyErrorBody = string | { error?: { status?: number; message?: string } | string; error_description?: string };

export type SpotifyProfileResult = { ok: true; username: string | null } | { ok: false; reason: 'not_registered' | 'error' };

export type LinkedSpotifyAccount = { tokens?: SpotifyTokens; spotifyId?: string; username?: string };

const formatSpotifyError = (error: unknown): string => {
	const axiosError = error as AxiosError<SpotifyErrorBody>;
	if (!axiosError?.isAxiosError) return `${error}`;

	const status = axiosError.response?.status ?? 'no response';
	const body = axiosError.response?.data;
	if (typeof body === 'string' && body.trim()) return `${status} - ${body.trim().slice(0, 300)}`;

	const fields = typeof body === 'object' && body !== null ? body : undefined;
	const reason = typeof fields?.error === 'string' ? fields.error_description || fields.error : fields?.error?.message;
	if (reason) return `${status} - ${reason}`;

	const raw = body === undefined || body === null || body === '' ? '<empty body>' : JSON.stringify(body).slice(0, 300);
	const challenge = axiosError.response?.headers?.['www-authenticate'];
	return `${status} - ${axiosError.message} | body: ${raw}${challenge ? ` | www-authenticate: ${challenge}` : ''}`;
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

	static parseProfileInput = (input: string): string | null => {
		const value = (input || '').trim();
		if (!value) return null;

		const uri = value.match(/^spotify:user:([^:?\s]+)$/i);
		const url = value.match(/^https?:\/\/open\.spotify\.com\/(?:[a-z-]+\/)?user\/([^/?#\s]+)/i);
		const raw = uri?.[1] ?? url?.[1] ?? value;

		let id = raw;
		try {
			id = decodeURIComponent(raw);
		} catch {
			id = raw;
		}

		return /^[A-Za-z0-9._~-]{1,64}$/.test(id) ? id : null;
	};

	resolveProfile = async (spotifyId: string): Promise<{ id: string; username: string } | null> => {
		const token = await getAppToken();
		if (!token) return null;
		try {
			const { data } = await axios.get<{ id?: string; display_name?: string }>(`https://api.spotify.com/v1/users/${encodeURIComponent(spotifyId)}`, { headers: { Authorization: `Bearer ${token}` } });
			if (!data?.id) return null;
			return { id: data.id, username: data.display_name || data.id };
		} catch (error) {
			this.client.logger.warn(`Error resolving Spotify profile [${spotifyId}]: ${formatSpotifyError(error)}`);
			return null;
		}
	};

	saveProfile = async (userId: string, spotifyId: string, username?: string): Promise<boolean> => {
		try {
			await UserAccount.findOneAndUpdate({ userId }, { $pull: { accounts: { type: 'spotify' } } }, { upsert: true });
			await UserAccount.findOneAndUpdate({ userId }, { $push: { accounts: { type: 'spotify', spotifyId, username } } }, { upsert: true });
			return true;
		} catch (error) {
			this.client.logger.error(`Error saving Spotify profile: ${error}`);
			return false;
		}
	};

	getLinkedAccount = async (userId: string): Promise<LinkedSpotifyAccount | null> => {
		try {
			const userAccount = await UserAccount.findOne({ userId });
			if (!userAccount) return null;
			const spotifyAccount = userAccount.accounts.find((acc) => acc.type === 'spotify');
			if (!spotifyAccount) return null;

			const access = spotifyAccount.token?.access;
			const refresh = spotifyAccount.token?.refresh;
			const tokens = access && refresh ? { access, refresh } : undefined;
			const spotifyId = spotifyAccount.spotifyId || undefined;
			if (!tokens && !spotifyId) return null;

			return { tokens, spotifyId, username: spotifyAccount.username || undefined };
		} catch (error) {
			this.client.logger.error(`Error getting account: ${error}`);
			return null;
		}
	};

	getAccount = async (userId: string): Promise<SpotifyTokens | null> => {
		const account = await this.getLinkedAccount(userId);
		return account?.tokens ?? null;
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

	getProfile = async (tokens: SpotifyTokens, userId: string): Promise<SpotifyProfileResult> => {
		try {
			const data = await this.makeRequest<{ display_name?: string; id?: string }>('https://api.spotify.com/v1/me', tokens, userId);
			return { ok: true, username: data.display_name || data.id || null };
		} catch (error) {
			this.client.logger.error(`Error getting Spotify profile: ${formatSpotifyError(error)}`);
			const axiosError = error as AxiosError<SpotifyErrorBody>;
			const body = axiosError.response?.data;
			const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
			if (axiosError.response?.status === 403 && /not registered/i.test(text)) return { ok: false, reason: 'not_registered' };
			return { ok: false, reason: 'error' };
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

	private mapPlaylists = (items: SpotifyPlaylistItem[], ownerId: string, next: string | null, offset: number, limit: number): PlaylistResponse => {
		const owned = (items || []).filter((playlist) => playlist?.owner?.id === ownerId);
		const playlists: PlaylistItem[] = owned.map((playlist) => ({ name: `${playlist.name} - Spotify`, value: playlist.external_urls.spotify }));
		return { playlists, hasMore: Boolean(next), nextOffset: offset + limit };
	};

	private getPlaylistsWithToken = async (tokens: SpotifyTokens, userId: string, offset: number, limit: number): Promise<PlaylistResponse | null> => {
		try {
			const data = await this.makeRequest<SpotifyPlaylistsResponse>('https://api.spotify.com/v1/me/playlists', tokens, userId, { params: { limit, offset } });
			const spotifyId = await this.getSpotifyId(tokens, userId);
			if (!spotifyId) return null;
			return this.mapPlaylists(data.items, spotifyId, data.next, offset, limit);
		} catch (error) {
			this.client.logger.error(`Error getting playlists: [${userId}] ${formatSpotifyError(error)}`);
			return null;
		}
	};

	getPublicPlaylists = async (spotifyId: string, offset: number = 0, limit: number = 10): Promise<PlaylistResponse | null> => {
		const token = await getAppToken();
		if (!token) return null;
		try {
			const { data } = await axios.get<SpotifyPlaylistsResponse>(`https://api.spotify.com/v1/users/${encodeURIComponent(spotifyId)}/playlists`, { headers: { Authorization: `Bearer ${token}` }, params: { limit, offset } });
			return this.mapPlaylists(data.items, spotifyId, data.next, offset, limit);
		} catch (error) {
			this.client.logger.error(`Error getting public playlists: [${spotifyId}] ${formatSpotifyError(error)}`);
			return null;
		}
	};

	getPlaylists = async (userId: string, offset: number = 0, limit: number = 10): Promise<PlaylistResponse | null> => {
		const account = await this.getLinkedAccount(userId);
		if (!account) return null;

		if (account.tokens) {
			const viaUser = await this.getPlaylistsWithToken(account.tokens, userId, offset, limit);
			if (viaUser) return viaUser;
		}

		return account.spotifyId ? this.getPublicPlaylists(account.spotifyId, offset, limit) : null;
	};
}
