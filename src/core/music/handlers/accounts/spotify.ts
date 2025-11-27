import axios from 'axios';
import crypto from 'crypto';
import discord from 'discord.js';

import { ConfigManager } from '../../../../utils/config';
import { PlaylistItem, PlaylistResponse } from '../../../../types';
import UserAccount from '../../../../events/database/schema/account_user';

const configManager = ConfigManager.getInstance();

export class SpotifyManager {
	private client: discord.Client;
	private static pendingStates = new Map<string, { userId: string; expiresAt: number }>();

	constructor(client: discord.Client) {
		this.client = client;
	}

	static generateAuthUrl = (userId: string): string => {
		const state = crypto.randomBytes(16).toString('hex');
		const expiresAt = Date.now() + 10 * 60 * 1000;
		this.pendingStates.set(state, { userId, expiresAt });

		setTimeout(() => this.pendingStates.delete(state), 10 * 60 * 1000);

		const params = new URLSearchParams({ client_id: configManager.getSpotifyClientId(), response_type: 'code', redirect_uri: configManager.getSpotifyRedirectUri(), state, scope: 'playlist-read-private playlist-read-collaborative' });
		return `https://accounts.spotify.com/authorize?${params.toString()}`;
	};

	static validateState = (state: string): string | null => {
		const data = this.pendingStates.get(state);
		if (!data) return null;

		if (Date.now() > data.expiresAt) {
			this.pendingStates.delete(state);
			return null;
		}

		this.pendingStates.delete(state);
		return data.userId;
	};

	exchangeCodeForTokens = async (code: string): Promise<{ access: string; refresh: string } | null> => {
		try {
			const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: configManager.getSpotifyRedirectUri() }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64')}` } });
			return { access: response.data.access_token, refresh: response.data.refresh_token };
		} catch (error) {
			this.client.logger.error(`Error exchanging code for tokens: ${error}`);
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

	getAccount = async (userId: string): Promise<{ access: string; refresh: string } | null> => {
		try {
			const userAccount = await UserAccount.findOne({ userId });
			if (!userAccount) return null;
			const spotifyAccount = userAccount.accounts.find((acc: any) => acc.type === 'spotify');
			if (!spotifyAccount || !spotifyAccount.token) return null;
			return spotifyAccount.token;
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

	getSpotifyUsername = async (accessToken: string): Promise<string | null> => {
		try {
			const response = await axios.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${accessToken}` } });
			return response.data.display_name || response.data.id;
		} catch (error) {
			this.client.logger.error(`Error getting Spotify username: ${error}`);
			return null;
		}
	};

	getPlaylists = async (userId: string, offset: number = 0, limit: number = 10): Promise<PlaylistResponse | null> => {
		try {
			const tokens = await this.getAccount(userId);
			if (!tokens) return null;
			const response = await axios.get('https://api.spotify.com/v1/me/playlists', { headers: { Authorization: `Bearer ${tokens.access}` }, params: { limit, offset } });
			const playlists: PlaylistItem[] = response.data.items.filter((playlist: any) => playlist.public).map((playlist: any) => ({ name: playlist.name, value: playlist.external_urls.spotify }));
			return { playlists, hasMore: response.data.next !== null, nextOffset: offset + limit };
		} catch (error) {
			this.client.logger.error(`Error getting playlists: ${error}`);
			return null;
		}
	};
}
