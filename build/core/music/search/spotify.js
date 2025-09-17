"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../utils/config");
class SpotifyService {
    constructor(client) {
        this.token = null;
        this.tokenExpiry = 0;
        this.cache = new Map();
        this.cleanupTimer = null;
        this.setupInterceptors = () => {
            this.spotifyApi.interceptors.response.use((response) => response, async (error) => {
                if (axios_1.default.isAxiosError(error)) {
                    if (error.response?.status === 401) {
                        await this.refreshToken();
                        const originalRequest = error.config;
                        if (originalRequest && originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${this.token}`;
                            return this.spotifyApi(originalRequest);
                        }
                    }
                }
                return Promise.reject(error);
            });
        };
        this.generateCacheKey = (type, query, options) => {
            const optionsStr = options ? JSON.stringify(options) : '';
            return `${type}:${query}:${optionsStr}`;
        };
        this.getCached = (key) => {
            if (!this.cacheConfig.enabled)
                return null;
            const entry = this.cache.get(key);
            if (!entry)
                return null;
            const now = Date.now();
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
                return null;
            }
            entry.lastAccessed = now;
            return entry.data;
        };
        this.setCached = (key, data, ttl) => {
            if (!this.cacheConfig.enabled)
                return;
            const now = Date.now();
            if (this.cache.size >= this.cacheConfig.maxSize)
                this.evictLRU();
            this.cache.set(key, { data, timestamp: now, lastAccessed: now, ttl });
        };
        this.evictLRU = () => {
            let oldestKey = null;
            let oldestTime = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (entry.lastAccessed < oldestTime) {
                    oldestTime = entry.lastAccessed;
                    oldestKey = key;
                }
            }
            if (oldestKey)
                this.cache.delete(oldestKey);
        };
        this.cleanup = () => {
            if (!this.cacheConfig.enabled)
                return;
            const now = Date.now();
            const toDelete = [];
            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > entry.ttl)
                    toDelete.push(key);
            }
            toDelete.forEach((key) => this.cache.delete(key));
        };
        this.startCleanupTimer = () => {
            if (this.cleanupTimer)
                clearInterval(this.cleanupTimer);
            this.cleanupTimer = setInterval(() => {
                this.cleanup();
            }, this.cacheConfig.cleanupInterval);
        };
        this.refreshToken = async () => {
            try {
                const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
                const { data } = await this.authApi.post('/token', 'grant_type=client_credentials', { headers: { Authorization: `Basic ${auth}` } });
                this.token = data.access_token;
                this.tokenExpiry = Date.now() + data.expires_in * 1000;
                this.spotifyApi.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    throw new Error(`Token refresh failed: ${error.response?.data?.error || error.message}`);
                }
                throw error;
            }
        };
        this.checkToken = async () => {
            if (!this.token || Date.now() >= this.tokenExpiry)
                await this.refreshToken();
        };
        this.searchTracks = async (query, options = {}) => {
            const cacheKey = this.generateCacheKey('search', query, options);
            const cached = this.getCached(cacheKey);
            if (cached)
                return cached;
            await this.checkToken();
            try {
                const searchParams = new URLSearchParams({ q: query, type: 'track', limit: String(options.limit || 20), offset: String(options.offset || 0) });
                if (options.market)
                    searchParams.append('market', options.market);
                if (options.includeExternal)
                    searchParams.append('include_external', options.includeExternal);
                const { data } = await this.spotifyApi.get(`/search?${searchParams.toString()}`);
                this.setCached(cacheKey, data, this.cacheConfig.defaultSearchTTL);
                return data;
            }
            catch (error) {
                this.client.logger.error(`[SPOTIFY_SEARCH] Search error: ${error}`);
                throw error;
            }
        };
        this.searchTracksByArtist = async (artist, limit = 20) => {
            try {
                const query = `artist:"${artist}"`;
                const response = await this.searchTracks(query, { limit });
                return response.tracks.items;
            }
            catch (error) {
                this.client.logger.error(`[SPOTIFY_SEARCH] Artist search error: ${error}`);
                return [];
            }
        };
        this.searchSimilarTracks = async (trackName, artistName, limit = 20) => {
            try {
                const query = `track:"${trackName}" artist:"${artistName}"`;
                const response = await this.searchTracks(query, { limit });
                return response.tracks.items;
            }
            catch (error) {
                this.client.logger.error(`[SPOTIFY_SEARCH] Similar tracks search error: ${error}`);
                return [];
            }
        };
        this.searchByGenre = async (genre, limit = 20) => {
            try {
                const query = `genre:"${genre}"`;
                const response = await this.searchTracks(query, { limit });
                return response.tracks.items;
            }
            catch (error) {
                this.client.logger.error(`[SPOTIFY_SEARCH] Genre search error: ${error}`);
                return [];
            }
        };
        this.convertSpotifyTrackToISongs = (track, requester) => {
            return {
                track: track.name,
                artworkUrl: track.album.images[0]?.url || '',
                sourceName: 'spotify',
                title: track.name,
                identifier: track.id,
                author: track.artists.map((artist) => artist.name).join(', '),
                duration: track.duration_ms,
                isrc: '',
                isSeekable: true,
                isStream: false,
                uri: track.external_urls.spotify,
                thumbnail: track.album.images[0]?.url || null,
                requester: requester || null,
                played_number: 1,
                timestamp: new Date(),
            };
        };
        this.getRecommendationsBasedOnTrack = async (seedTrack, limit = 20) => {
            try {
                const recommendations = [];
                const artistTracks = await this.searchTracksByArtist(seedTrack.author, Math.ceil(limit * 0.4));
                const artistRecommendations = artistTracks
                    .filter((track) => track.id !== seedTrack.identifier)
                    .slice(0, Math.ceil(limit * 0.4))
                    .map((track) => this.convertSpotifyTrackToISongs(track));
                recommendations.push(...artistRecommendations);
                const similarTracks = await this.searchSimilarTracks(seedTrack.title, seedTrack.author, Math.ceil(limit * 0.6));
                const similarRecommendations = similarTracks
                    .filter((track) => track.id !== seedTrack.identifier && !recommendations.some((rec) => rec.identifier === track.id))
                    .slice(0, Math.ceil(limit * 0.6))
                    .map((track) => this.convertSpotifyTrackToISongs(track));
                recommendations.push(...similarRecommendations);
                return this.shuffleArray(recommendations).slice(0, limit);
            }
            catch (error) {
                this.client.logger.error(`[SPOTIFY_SEARCH] Get recommendations error: ${error}`);
                return [];
            }
        };
        this.shuffleArray = (array) => {
            if (!array || array.length === 0)
                return [];
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        };
        this.clearCache = () => {
            this.cache.clear();
        };
        this.getCacheStats = () => {
            return { size: this.cache.size, maxSize: this.cacheConfig.maxSize };
        };
        this.destroy = () => {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
            this.clearCache();
        };
        this.client = client;
        this.configManager = config_1.ConfigManager.getInstance();
        this.clientId = this.configManager.getSpotifyClientId();
        this.clientSecret = this.configManager.getSpotifyClientSecret();
        this.cacheConfig = {
            enabled: client.config.music.cache.enabled,
            maxSize: client.config.music.cache.max_size,
            defaultSearchTTL: client.config.music.cache.default_search_ttl,
            defaultUrlTTL: client.config.music.cache.defaukt_url_ttl,
            cleanupInterval: client.config.music.cache.cleanup_interval,
        };
        this.spotifyApi = axios_1.default.create({ baseURL: 'https://api.spotify.com/v1', timeout: 10000, headers: { 'Content-Type': 'application/json' } });
        this.authApi = axios_1.default.create({ baseURL: 'https://accounts.spotify.com/api', timeout: 10000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        this.setupInterceptors();
        if (this.cacheConfig.enabled)
            this.startCleanupTimer();
    }
}
exports.SpotifyService = SpotifyService;
SpotifyService.getInstance = (client) => {
    if (!SpotifyService.instance)
        SpotifyService.instance = new SpotifyService(client);
    return SpotifyService.instance;
};
