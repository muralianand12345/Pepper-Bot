"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyManager = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../../../../utils/config");
const account_user_1 = __importDefault(require("../../../../events/database/schema/account_user"));
const configManager = config_1.ConfigManager.getInstance();
class SpotifyManager {
    constructor(client) {
        this.makeRequest = async (url, tokens, userId, options = {}) => {
            try {
                const response = await (0, axios_1.default)({ url, headers: { Authorization: `Bearer ${tokens.access}` }, ...options });
                return response.data;
            }
            catch (error) {
                if (error.response?.status === 401) {
                    const newTokens = await this.refreshTokens(tokens.refresh, userId);
                    if (!newTokens)
                        throw error;
                    const retryResponse = await (0, axios_1.default)({ url, headers: { Authorization: `Bearer ${newTokens.access}` }, ...options });
                    return retryResponse.data;
                }
                throw error;
            }
        };
        this.refreshTokens = async (refreshToken, userId) => {
            try {
                const response = await axios_1.default.post('https://accounts.spotify.com/api/token', new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64')}` } });
                const newTokens = { access: response.data.access_token, refresh: response.data.refresh_token || refreshToken };
                await this.saveAccount(userId, newTokens);
                return newTokens;
            }
            catch (error) {
                this.client.logger.error(`Failed to refresh token: ${error}`);
                return null;
            }
        };
        this.exchangeCodeForTokens = async (code) => {
            try {
                const response = await axios_1.default.post('https://accounts.spotify.com/api/token', new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: configManager.getSpotifyRedirectUri() }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64')}` } });
                return { access: response.data.access_token, refresh: response.data.refresh_token };
            }
            catch (error) {
                this.client.logger.error(`Error exchanging code for tokens: ${error}`);
                return null;
            }
        };
        this.saveAccount = async (userId, tokens, username) => {
            try {
                await account_user_1.default.findOneAndUpdate({ userId }, { $set: { 'accounts.$[elem]': { type: 'spotify', token: tokens, username } } }, { arrayFilters: [{ 'elem.type': 'spotify' }], upsert: false });
                const updated = await account_user_1.default.findOne({ userId, 'accounts.type': 'spotify' });
                if (!updated)
                    await account_user_1.default.findOneAndUpdate({ userId }, { $push: { accounts: { type: 'spotify', token: tokens, username } } }, { upsert: true });
                return true;
            }
            catch (error) {
                this.client.logger.error(`Error saving account: ${error}`);
                return false;
            }
        };
        this.getAccount = async (userId) => {
            try {
                const userAccount = await account_user_1.default.findOne({ userId });
                if (!userAccount)
                    return null;
                const spotifyAccount = userAccount.accounts.find((acc) => acc.type === 'spotify');
                if (!spotifyAccount || !spotifyAccount.token)
                    return null;
                return spotifyAccount.token;
            }
            catch (error) {
                this.client.logger.error(`Error getting account: ${error}`);
                return null;
            }
        };
        this.removeAccount = async (userId) => {
            try {
                await account_user_1.default.findOneAndUpdate({ userId }, { $pull: { accounts: { type: 'spotify' } } });
                return true;
            }
            catch (error) {
                this.client.logger.error(`Error removing account: ${error}`);
                return false;
            }
        };
        this.getSpotifyUsername = async (accessToken) => {
            try {
                const response = await axios_1.default.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${accessToken}` } });
                return response.data.display_name || response.data.id;
            }
            catch (error) {
                this.client.logger.error(`Error getting Spotify username: ${error}`);
                return null;
            }
        };
        this.getPlaylists = async (userId, offset = 0, limit = 10) => {
            try {
                const tokens = await this.getAccount(userId);
                if (!tokens)
                    return null;
                const data = await this.makeRequest('https://api.spotify.com/v1/me/playlists', tokens, userId, { params: { limit, offset } });
                const playlists = data.items.filter((playlist) => playlist.public).map((playlist) => ({ name: playlist.name, value: playlist.external_urls.spotify }));
                return { playlists, hasMore: data.next !== null, nextOffset: offset + limit };
            }
            catch (error) {
                this.client.logger.error(`Error getting playlists: ${error}`);
                return null;
            }
        };
        this.client = client;
    }
}
exports.SpotifyManager = SpotifyManager;
_a = SpotifyManager;
SpotifyManager.pendingStates = new Map();
SpotifyManager.generateAuthUrl = (userId) => {
    const state = crypto_1.default.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000;
    _a.pendingStates.set(state, { userId, expiresAt });
    setTimeout(() => _a.pendingStates.delete(state), 10 * 60 * 1000);
    const params = new URLSearchParams({ client_id: configManager.getSpotifyClientId(), response_type: 'code', redirect_uri: configManager.getSpotifyRedirectUri(), state, scope: 'playlist-read-private playlist-read-collaborative' });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
};
SpotifyManager.validateState = (state) => {
    const data = _a.pendingStates.get(state);
    if (!data)
        return null;
    if (Date.now() > data.expiresAt) {
        _a.pendingStates.delete(state);
        return null;
    }
    _a.pendingStates.delete(state);
    return data.userId;
};
