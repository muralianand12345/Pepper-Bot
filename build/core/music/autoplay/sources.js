"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagSimilarity = exports.deezerArtistRadio = exports.lastfmArtistTags = exports.lastfmSimilarTracks = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../utils/config");
const match_1 = require("./match");
const configManager = config_1.ConfigManager.getInstance();
const HOUR = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const TAG_LIMIT = 8;
const TAG_STOPLIST = new Set(['seenlive', 'all', 'favorites', 'favourites', 'favorite', 'favourite', 'myfavorite', 'awesome', 'love', 'beautiful', 'amazing', 'cool', 'good', 'best', 'spotify', 'under2000listeners']);
class TtlCache {
    constructor(ttlMs, maxSize = 2000) {
        this.entries = new Map();
        this.get = (key) => {
            const entry = this.entries.get(key);
            if (!entry)
                return undefined;
            if (entry.expiresAt <= Date.now()) {
                this.entries.delete(key);
                return undefined;
            }
            return entry.value;
        };
        this.set = (key, value) => {
            if (this.entries.size >= this.maxSize) {
                const oldest = this.entries.keys().next().value;
                if (oldest !== undefined)
                    this.entries.delete(oldest);
            }
            this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        };
        this.wrap = async (key, producer) => {
            const cached = this.get(key);
            if (cached !== undefined)
                return cached;
            const value = await producer();
            this.set(key, value);
            return value;
        };
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;
    }
}
const lastfm = axios_1.default.create({ baseURL: 'https://ws.audioscrobbler.com/2.0/', timeout: REQUEST_TIMEOUT_MS });
const deezer = axios_1.default.create({ baseURL: 'https://api.deezer.com', timeout: REQUEST_TIMEOUT_MS });
const similarCache = new TtlCache(6 * HOUR);
const tagCache = new TtlCache(24 * HOUR, 5000);
const deezerArtistCache = new TtlCache(24 * HOUR, 5000);
const deezerRadioCache = new TtlCache(HOUR);
const LASTFM_NOT_FOUND = 6;
const DEEZER_NO_DATA = 800;
const lastfmGet = async (params) => {
    const response = await lastfm.get('', { params: { ...params, api_key: configManager.getLastFmApiKey(), format: 'json', autocorrect: 1 }, validateStatus: () => true });
    const error = response.data?.error;
    if (error === LASTFM_NOT_FOUND)
        return null;
    if (error || response.status >= 400)
        throw new Error(`Last.fm ${error ?? response.status}: ${response.data?.message ?? 'request failed'}`);
    return response.data;
};
const deezerGet = async (url, params) => {
    const response = await deezer.get(url, { params });
    const error = response.data?.error;
    if (error?.code === DEEZER_NO_DATA)
        return null;
    if (error)
        throw new Error(`Deezer ${error.code}: ${error.message}`);
    return response.data;
};
const toSeconds = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
};
const lastfmSimilarTracks = async (ref, limit = 25) => {
    const key = `${(0, match_1.normalizeTitle)(ref.title)}|${(0, match_1.primaryArtist)(ref.artist)}`;
    return similarCache.wrap(key, async () => {
        const data = await lastfmGet({ method: 'track.getSimilar', artist: ref.artist, track: ref.title, limit });
        return (data?.similartracks?.track ?? []).filter((track) => track.name && track.artist?.name).map((track) => ({ title: track.name, artist: track.artist.name, match: Math.min(1, Math.max(0, Number(track.match) || 0)), duration: toSeconds(track.duration) }));
    });
};
exports.lastfmSimilarTracks = lastfmSimilarTracks;
const lastfmArtistTags = async (artist) => {
    const key = (0, match_1.primaryArtist)(artist);
    if (!key)
        return new Map();
    return tagCache.wrap(key, async () => {
        const data = await lastfmGet({ method: 'artist.getTopTags', artist });
        const tags = new Map();
        for (const tag of data?.toptags?.tag ?? []) {
            const name = (0, match_1.normalizeText)(tag.name);
            const weight = Number(tag.count) / 100;
            if (!name || TAG_STOPLIST.has(name) || /^\d+$/.test(name) || !(weight >= 0.05))
                continue;
            tags.set(name, Math.min(1, weight));
            if (tags.size >= TAG_LIMIT)
                break;
        }
        return tags;
    });
};
exports.lastfmArtistTags = lastfmArtistTags;
const toDeezerTrack = (track) => (track?.id && track.title && track.artist?.name ? { deezerId: track.id, title: track.title, artist: track.artist.name, duration: toSeconds(track.duration) } : null);
const deezerArtistId = async (ref) => {
    const artistKey = (0, match_1.primaryArtist)(ref.artist);
    if (!artistKey)
        return null;
    return deezerArtistCache.wrap(artistKey, async () => {
        const tracks = await deezerGet('/search', { q: `${ref.artist} ${ref.title}`, limit: 10 });
        const byTrack = (tracks?.data ?? []).find((track) => track.artist && (0, match_1.primaryArtist)(track.artist.name) === artistKey);
        if (byTrack?.artist)
            return byTrack.artist.id;
        const artists = await deezerGet('/search/artist', { q: ref.artist, limit: 5 });
        const byName = (artists?.data ?? []).find((artist) => (0, match_1.primaryArtist)(artist.name) === artistKey);
        return byName?.id ?? null;
    });
};
const deezerArtistRadio = async (ref) => {
    const artistId = await deezerArtistId(ref);
    if (!artistId)
        return [];
    return deezerRadioCache.wrap(String(artistId), async () => {
        const radio = await deezerGet(`/artist/${artistId}/radio`, { limit: 25 });
        return (radio?.data ?? []).map(toDeezerTrack).filter((track) => track !== null);
    });
};
exports.deezerArtistRadio = deezerArtistRadio;
const tagSimilarity = (a, b) => {
    if (!a.size || !b.size)
        return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [tag, weight] of a) {
        normA += weight * weight;
        const other = b.get(tag);
        if (other)
            dot += weight * other;
    }
    for (const weight of b.values())
        normB += weight * weight;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};
exports.tagSimilarity = tagSimilarity;
