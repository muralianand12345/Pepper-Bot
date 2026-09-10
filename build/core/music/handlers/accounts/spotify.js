"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../../utils/config");
const account_user_1 = __importDefault(require("../../../../events/database/schema/account_user"));
const configManager = config_1.ConfigManager.getInstance();
const formatSpotifyError = (error) => {
    const axiosError = error;
    if (!axiosError?.isAxiosError)
        return `${error}`;
    const status = axiosError.response?.status;
    const body = axiosError.response?.data;
    const reason = typeof body?.error === 'string' ? body.error_description || body.error : body?.error?.message;
    if (reason)
        return `${status} - ${reason}`;
    const rawBody = body;
    const raw = rawBody === undefined || rawBody === null || rawBody === '' ? '<empty body>' : JSON.stringify(rawBody).slice(0, 300);
    const challenge = axiosError.response?.headers?.['www-authenticate'];
    return `${status ?? 'no response'} - ${axiosError.message} | body: ${raw}${challenge ? ` | www-authenticate: ${challenge}` : ''}`;
};
class SpotifyManager {
    constructor(client) {
        this.makeRequest = async (url, tokens, userId, options = {}) => {
            try {
                const response = await (0, axios_1.default)({ url, headers: { Authorization: `Bearer ${tokens.access}` }, ...options });
                return response.data;
            }
            catch (error) {
                const axiosError = error;
                if (axiosError.response?.status === 401) {
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
                this.client.logger.error(`Failed to refresh token: ${formatSpotifyError(error)}`);
                return null;
            }
        };
        this.exchangeCodeForTokens = async (code) => {
            try {
                const response = await axios_1.default.post('https://accounts.spotify.com/api/token', new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: configManager.getSpotifyRedirectUri() }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64')}` } });
                return { access: response.data.access_token, refresh: response.data.refresh_token };
            }
            catch (error) {
                this.client.logger.error(`Error exchanging code for tokens: ${formatSpotifyError(error)}`);
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
                if (!spotifyAccount?.token)
                    return null;
                return { access: spotifyAccount.token.access, refresh: spotifyAccount.token.refresh };
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
        this.getSpotifyUsername = async (tokens, userId) => {
            try {
                const data = await this.makeRequest('https://api.spotify.com/v1/me', tokens, userId);
                return data.display_name || data.id || null;
            }
            catch (error) {
                this.client.logger.error(`Error getting Spotify username: ${formatSpotifyError(error)}`);
                return null;
            }
        };
        this.getSpotifyId = async (tokens, userId) => {
            try {
                const data = await this.makeRequest('https://api.spotify.com/v1/me', tokens, userId);
                return data.id || null;
            }
            catch (error) {
                this.client.logger.error(`Error getting Spotify ID: ${formatSpotifyError(error)}`);
                return null;
            }
        };
        this.getPlaylists = async (userId, offset = 0, limit = 10) => {
            try {
                const tokens = await this.getAccount(userId);
                if (!tokens)
                    return null;
                const data = await this.makeRequest('https://api.spotify.com/v1/me/playlists', tokens, userId, { params: { limit, offset } });
                const spotifyId = await this.getSpotifyId(tokens, userId);
                if (!spotifyId)
                    return null;
                const owned = (data.items || []).filter((playlist) => playlist.owner?.id === spotifyId);
                const playlists = owned.map((playlist) => ({ name: `${playlist.name} - Spotify`, value: playlist.external_urls.spotify }));
                return { playlists, hasMore: data.next !== null, nextOffset: offset + limit };
            }
            catch (error) {
                this.client.logger.error(`Error getting playlists: [${userId}] ${formatSpotifyError(error)}`);
                return null;
            }
        };
        this.client = client;
    }
}
exports.SpotifyManager = SpotifyManager;
_a = SpotifyManager;
SpotifyManager.STATE_TTL_MS = 10 * 60 * 1000;
SpotifyManager.signState = (payload) => crypto_1.default.createHmac('sha256', configManager.getSpotifyClientSecret()).update(payload).digest('base64url');
SpotifyManager.generateAuthUrl = (userId) => {
    const payload = Buffer.from(`${userId}:${Date.now() + _a.STATE_TTL_MS}:${crypto_1.default.randomBytes(8).toString('hex')}`).toString('base64url');
    const state = `${payload}.${_a.signState(payload)}`;
    const params = new URLSearchParams({ client_id: configManager.getSpotifyClientId(), response_type: 'code', redirect_uri: configManager.getSpotifyRedirectUri(), state, scope: 'playlist-read-private playlist-read-collaborative' });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
};
SpotifyManager.validateState = (state) => {
    if (typeof state !== 'string' || !state)
        return null;
    const separator = state.lastIndexOf('.');
    if (separator <= 0)
        return null;
    const payload = state.slice(0, separator);
    const provided = Buffer.from(state.slice(separator + 1));
    const expected = Buffer.from(_a.signState(payload));
    if (provided.length !== expected.length || !crypto_1.default.timingSafeEqual(provided, expected))
        return null;
    const [userId, expiresAt] = Buffer.from(payload, 'base64url').toString().split(':');
    if (!userId || !expiresAt)
        return null;
    if (Date.now() > Number(expiresAt))
        return null;
    return userId;
};
