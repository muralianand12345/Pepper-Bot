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
const app_token_1 = require("./app_token");
const account_user_1 = __importDefault(require("../../../../events/database/schema/account_user"));
const configManager = config_1.ConfigManager.getInstance();
const formatSpotifyError = (error) => {
    const axiosError = error;
    if (!axiosError?.isAxiosError)
        return `${error}`;
    const status = axiosError.response?.status ?? 'no response';
    const body = axiosError.response?.data;
    if (typeof body === 'string' && body.trim())
        return `${status} - ${body.trim().slice(0, 300)}`;
    const fields = typeof body === 'object' && body !== null ? body : undefined;
    const reason = typeof fields?.error === 'string' ? fields.error_description || fields.error : fields?.error?.message;
    if (reason)
        return `${status} - ${reason}`;
    const raw = body === undefined || body === null || body === '' ? '<empty body>' : JSON.stringify(body).slice(0, 300);
    const challenge = axiosError.response?.headers?.['www-authenticate'];
    return `${status} - ${axiosError.message} | body: ${raw}${challenge ? ` | www-authenticate: ${challenge}` : ''}`;
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
        this.resolveProfile = async (spotifyId) => {
            const token = await (0, app_token_1.getAppToken)();
            if (!token)
                return null;
            try {
                const { data } = await axios_1.default.get(`https://api.spotify.com/v1/users/${encodeURIComponent(spotifyId)}`, { headers: { Authorization: `Bearer ${token}` } });
                if (!data?.id)
                    return null;
                return { id: data.id, username: data.display_name || data.id };
            }
            catch (error) {
                this.client.logger.warn(`Error resolving Spotify profile [${spotifyId}]: ${formatSpotifyError(error)}`);
                return null;
            }
        };
        this.saveProfile = async (userId, spotifyId, username) => {
            try {
                await account_user_1.default.findOneAndUpdate({ userId }, { $pull: { accounts: { type: 'spotify' } } }, { upsert: true });
                await account_user_1.default.findOneAndUpdate({ userId }, { $push: { accounts: { type: 'spotify', spotifyId, username } } }, { upsert: true });
                return true;
            }
            catch (error) {
                this.client.logger.error(`Error saving Spotify profile: ${error}`);
                return false;
            }
        };
        this.getLinkedAccount = async (userId) => {
            try {
                const userAccount = await account_user_1.default.findOne({ userId });
                if (!userAccount)
                    return null;
                const spotifyAccount = userAccount.accounts.find((acc) => acc.type === 'spotify');
                if (!spotifyAccount)
                    return null;
                const access = spotifyAccount.token?.access;
                const refresh = spotifyAccount.token?.refresh;
                const tokens = access && refresh ? { access, refresh } : undefined;
                const spotifyId = spotifyAccount.spotifyId || undefined;
                if (!tokens && !spotifyId)
                    return null;
                return { tokens, spotifyId, username: spotifyAccount.username || undefined };
            }
            catch (error) {
                this.client.logger.error(`Error getting account: ${error}`);
                return null;
            }
        };
        this.getAccount = async (userId) => {
            const account = await this.getLinkedAccount(userId);
            return account?.tokens ?? null;
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
        this.getProfile = async (tokens, userId) => {
            try {
                const data = await this.makeRequest('https://api.spotify.com/v1/me', tokens, userId);
                return { ok: true, username: data.display_name || data.id || null };
            }
            catch (error) {
                this.client.logger.error(`Error getting Spotify profile: ${formatSpotifyError(error)}`);
                const axiosError = error;
                const body = axiosError.response?.data;
                const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
                if (axiosError.response?.status === 403 && /not registered/i.test(text))
                    return { ok: false, reason: 'not_registered' };
                return { ok: false, reason: 'error' };
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
        this.mapPlaylists = (items, ownerId, next, offset, limit) => {
            const owned = (items || []).filter((playlist) => playlist?.owner?.id === ownerId);
            const playlists = owned.map((playlist) => ({ name: `${playlist.name} - Spotify`, value: playlist.external_urls.spotify }));
            return { playlists, hasMore: Boolean(next), nextOffset: offset + limit };
        };
        this.getPlaylistsWithToken = async (tokens, userId, offset, limit) => {
            try {
                const data = await this.makeRequest('https://api.spotify.com/v1/me/playlists', tokens, userId, { params: { limit, offset } });
                const spotifyId = await this.getSpotifyId(tokens, userId);
                if (!spotifyId)
                    return null;
                return this.mapPlaylists(data.items, spotifyId, data.next, offset, limit);
            }
            catch (error) {
                this.client.logger.error(`Error getting playlists: [${userId}] ${formatSpotifyError(error)}`);
                return null;
            }
        };
        this.getPublicPlaylists = async (spotifyId, offset = 0, limit = 10) => {
            const token = await (0, app_token_1.getAppToken)();
            if (!token)
                return null;
            try {
                const { data } = await axios_1.default.get(`https://api.spotify.com/v1/users/${encodeURIComponent(spotifyId)}/playlists`, { headers: { Authorization: `Bearer ${token}` }, params: { limit, offset } });
                return this.mapPlaylists(data.items, spotifyId, data.next, offset, limit);
            }
            catch (error) {
                this.client.logger.error(`Error getting public playlists: [${spotifyId}] ${formatSpotifyError(error)}`);
                return null;
            }
        };
        this.getPlaylists = async (userId, offset = 0, limit = 10) => {
            const account = await this.getLinkedAccount(userId);
            if (!account)
                return null;
            if (account.tokens) {
                const viaUser = await this.getPlaylistsWithToken(account.tokens, userId, offset, limit);
                if (viaUser)
                    return viaUser;
            }
            return account.spotifyId ? this.getPublicPlaylists(account.spotifyId, offset, limit) : null;
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
SpotifyManager.parseProfileInput = (input) => {
    const value = (input || '').trim();
    if (!value)
        return null;
    const uri = value.match(/^spotify:user:([^:?\s]+)$/i);
    const url = value.match(/^https?:\/\/open\.spotify\.com\/(?:[a-z-]+\/)?user\/([^/?#\s]+)/i);
    const raw = uri?.[1] ?? url?.[1] ?? value;
    let id = raw;
    try {
        id = decodeURIComponent(raw);
    }
    catch {
        id = raw;
    }
    return /^[A-Za-z0-9._~-]{1,64}$/.test(id) ? id : null;
};
