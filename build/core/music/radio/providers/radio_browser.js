"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioBrowser = void 0;
const axios_1 = __importDefault(require("axios"));
const package_json_1 = require("../../../../../package.json");
const FALLBACK_HOST = 'https://de1.api.radio-browser.info';
const SERVER_LIST_URL = 'https://all.api.radio-browser.info/json/servers';
const SERVER_TTL_MS = 60 * 60 * 1000;
class RadioBrowser {
    constructor(client) {
        this.cache = new Map();
        this.resolveHost = async () => {
            if (RadioBrowser.host && Date.now() - RadioBrowser.hostResolvedAt < SERVER_TTL_MS)
                return RadioBrowser.host;
            if (RadioBrowser.hostPromise)
                return RadioBrowser.hostPromise;
            RadioBrowser.hostPromise = (async () => {
                try {
                    const { data } = await this.http.get(SERVER_LIST_URL);
                    const names = [...new Set((data || []).map((server) => server.name).filter(Boolean))];
                    const host = names.length ? `https://${names[Math.floor(Math.random() * names.length)]}` : FALLBACK_HOST;
                    RadioBrowser.host = host;
                    RadioBrowser.hostResolvedAt = Date.now();
                    this.client.logger.debug(`[RADIO_BROWSER] Using mirror ${host}`);
                    return host;
                }
                catch (error) {
                    this.client.logger.warn(`[RADIO_BROWSER] Server discovery failed, falling back to ${FALLBACK_HOST}: ${error}`);
                    RadioBrowser.host = FALLBACK_HOST;
                    RadioBrowser.hostResolvedAt = Date.now();
                    return FALLBACK_HOST;
                }
                finally {
                    RadioBrowser.hostPromise = null;
                }
            })();
            return RadioBrowser.hostPromise;
        };
        this.getCached = (key) => {
            if (!this.cacheConfig.enabled)
                return null;
            const entry = this.cache.get(key);
            if (!entry)
                return null;
            if (Date.now() - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
                return null;
            }
            entry.lastAccessed = Date.now();
            return entry.data;
        };
        this.setCached = (key, data, ttl) => {
            if (!this.cacheConfig.enabled)
                return;
            if (this.cache.size >= this.cacheConfig.maxSize) {
                let oldestKey = null;
                let oldestTime = Date.now();
                for (const [entryKey, entry] of this.cache.entries()) {
                    if (entry.lastAccessed < oldestTime) {
                        oldestTime = entry.lastAccessed;
                        oldestKey = entryKey;
                    }
                }
                if (oldestKey)
                    this.cache.delete(oldestKey);
            }
            const now = Date.now();
            this.cache.set(key, { data, timestamp: now, lastAccessed: now, ttl });
        };
        this.toStation = (raw) => {
            if (!raw?.stationuuid || !raw.url_resolved)
                return null;
            if (raw.lastcheckok !== 1 || raw.ssl_error)
                return null;
            const genre = (raw.tags || '')
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)[0];
            return {
                id: raw.stationuuid,
                name: raw.name?.trim() || 'Unknown Station',
                genre: genre ? genre.charAt(0).toUpperCase() + genre.slice(1) : 'Radio',
                country: raw.countrycode || null,
                url: raw.url_resolved,
                codec: raw.codec || 'MP3',
                bitrate: raw.bitrate || 0,
                artworkUrl: raw.favicon?.startsWith('http') ? raw.favicon : null,
                homepage: raw.homepage?.startsWith('http') ? raw.homepage : null,
                source: 'radiobrowser',
            };
        };
        this.search = async (query, options = {}) => {
            const trimmed = query.trim();
            if (!trimmed)
                return [];
            const limit = options.limit ?? 20;
            const cacheKey = `search:${trimmed.toLowerCase()}:${options.countryCode ?? ''}:${limit}`;
            const cached = this.getCached(cacheKey);
            if (cached)
                return cached;
            try {
                const host = await this.resolveHost();
                const params = { name: trimmed, limit, hidebroken: 'true', order: 'votes', reverse: 'true' };
                if (options.countryCode)
                    params.countrycode = options.countryCode;
                const { data } = await this.http.get(`${host}/json/stations/search`, { params });
                const stations = (data || []).map(this.toStation).filter((station) => station !== null);
                this.setCached(cacheKey, stations, this.cacheConfig.defaultSearchTTL);
                return stations;
            }
            catch (error) {
                this.client.logger.warn(`[RADIO_BROWSER] Search failed for "${trimmed}": ${error}`);
                return [];
            }
        };
        this.getByUuid = async (uuid) => {
            const cacheKey = `uuid:${uuid}`;
            const cached = this.getCached(cacheKey);
            if (cached)
                return cached;
            try {
                const host = await this.resolveHost();
                const { data } = await this.http.get(`${host}/json/stations/byuuid/${encodeURIComponent(uuid)}`);
                const station = data?.length ? this.toStation(data[0]) : null;
                if (station)
                    this.setCached(cacheKey, station, this.cacheConfig.defaultUrlTTL);
                return station;
            }
            catch (error) {
                this.client.logger.warn(`[RADIO_BROWSER] Lookup failed for ${uuid}: ${error}`);
                return null;
            }
        };
        this.reportClick = (uuid) => {
            void this.resolveHost()
                .then((host) => this.http.get(`${host}/json/url/${encodeURIComponent(uuid)}`))
                .catch((error) => this.client.logger.debug(`[RADIO_BROWSER] Click report failed for ${uuid}: ${error}`));
        };
        this.client = client;
        this.cacheConfig = {
            enabled: client.config.music.cache.enabled,
            maxSize: client.config.music.cache.max_size,
            defaultSearchTTL: client.config.music.cache.default_search_ttl,
            defaultUrlTTL: client.config.music.cache.defaukt_url_ttl,
            cleanupInterval: client.config.music.cache.cleanup_interval,
        };
        this.http = axios_1.default.create({ timeout: 8000, headers: { 'User-Agent': `PepperBot/${package_json_1.version} (+https://github.com/muralianand12345/Pepper-Bot)` } });
    }
}
exports.RadioBrowser = RadioBrowser;
RadioBrowser.host = null;
RadioBrowser.hostResolvedAt = 0;
RadioBrowser.hostPromise = null;
