"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioManager = void 0;
const radio_browser_api_1 = require("radio-browser-api");
class RadioManager {
    constructor(client) {
        this.cache = new Map();
        this.CACHE_TTL = 300000; // 5 minutes
        this.MAX_CACHE_SIZE = 1000;
        this.generateCacheKey = (options) => {
            return JSON.stringify(options);
        };
        this.getCached = (key) => {
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
        this.setCached = (key, data) => {
            const now = Date.now();
            if (this.cache.size >= this.MAX_CACHE_SIZE) {
                this.evictLRU();
            }
            this.cache.set(key, {
                data,
                timestamp: now,
                lastAccessed: now,
                ttl: this.CACHE_TTL,
            });
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
        this.startCleanupTimer = () => {
            setInterval(() => {
                const now = Date.now();
                const toDelete = [];
                for (const [key, entry] of this.cache.entries()) {
                    if (now - entry.timestamp > entry.ttl) {
                        toDelete.push(key);
                    }
                }
                toDelete.forEach((key) => this.cache.delete(key));
            }, 60000); // Clean every minute
        };
        this.searchStations = async (options) => {
            const cacheKey = this.generateCacheKey(options);
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.client.logger.debug(`[RADIO] Cache hit for search: ${cacheKey}`);
                return cached;
            }
            try {
                this.client.logger.debug(`[RADIO] Searching stations with options: ${JSON.stringify(options)}`);
                const searchParams = {
                    ...options,
                    limit: options.limit || 25,
                    offset: options.offset || 0,
                    removeDuplicates: true,
                    hideBroken: true,
                    order: 'clickTrend',
                };
                const stations = await this.api.searchStations(searchParams);
                if (!Array.isArray(stations)) {
                    this.client.logger.error(`[RADIO] API returned non-array response: ${JSON.stringify(stations)}`);
                    return [];
                }
                const filteredStations = stations.filter((station) => station.lastCheckOk && station.urlResolved);
                this.setCached(cacheKey, filteredStations);
                this.client.logger.info(`[RADIO] Found ${filteredStations.length} stations`);
                return filteredStations;
            }
            catch (error) {
                let errorMessage = 'Unknown error';
                if (error instanceof Response) {
                    try {
                        const errorText = await error.text();
                        errorMessage = `HTTP ${error.status}: ${errorText}`;
                    }
                    catch (parseError) {
                        errorMessage = `HTTP ${error.status}: ${error.statusText}`;
                    }
                }
                else if (error instanceof Error) {
                    errorMessage = error.message;
                }
                else if (typeof error === 'string') {
                    errorMessage = error;
                }
                else {
                    errorMessage = JSON.stringify(error);
                }
                this.client.logger.error(`[RADIO] Search error: ${errorMessage}`);
                return [];
            }
        };
        this.getStationById = async (stationId) => {
            try {
                this.client.logger.debug(`[RADIO] Getting station by ID: ${stationId}`);
                const stations = await this.api.getStationsBy('byUuid', stationId);
                if (!Array.isArray(stations)) {
                    this.client.logger.error(`[RADIO] getStationsBy returned non-array: ${JSON.stringify(stations)}`);
                    return null;
                }
                const station = stations.find((s) => s.id === stationId) || null;
                if (!station) {
                    this.client.logger.warn(`[RADIO] Station not found with ID: ${stationId}`);
                }
                else {
                    this.client.logger.debug(`[RADIO] Found station: ${station.name}`);
                }
                return station;
            }
            catch (error) {
                let errorMessage = 'Unknown error';
                if (error instanceof Response) {
                    try {
                        const errorText = await error.text();
                        errorMessage = `HTTP ${error.status}: ${errorText}`;
                    }
                    catch (parseError) {
                        errorMessage = `HTTP ${error.status}: ${error.statusText}`;
                    }
                }
                else if (error instanceof Error) {
                    errorMessage = error.message;
                }
                else if (typeof error === 'string') {
                    errorMessage = error;
                }
                else {
                    errorMessage = JSON.stringify(error);
                }
                this.client.logger.error(`[RADIO] Get station by ID error: ${errorMessage}`);
                return null;
            }
        };
        this.getTopStationsByCountry = async (countryCode, limit = 10) => {
            return this.searchStations({
                countryCode,
                limit,
            });
        };
        this.getTopStationsByLanguage = async (language, limit = 10) => {
            return this.searchStations({
                language,
                limit,
            });
        };
        this.clearCache = () => {
            this.cache.clear();
            this.client.logger.info('[RADIO] Cache cleared');
        };
        this.getCacheStats = () => {
            return {
                size: this.cache.size,
                maxSize: this.MAX_CACHE_SIZE,
            };
        };
        this.testConnection = async () => {
            try {
                this.client.logger.info('[RADIO] Testing API connection...');
                // Try a simple search to test the connection
                const testStations = await this.api.searchStations({
                    limit: 1,
                    hideBroken: true,
                });
                if (Array.isArray(testStations) && testStations.length > 0) {
                    this.client.logger.info(`[RADIO] API connection successful. Found test station: ${testStations[0].name}`);
                    return true;
                }
                else {
                    this.client.logger.warn('[RADIO] API connection returned empty or invalid result');
                    return false;
                }
            }
            catch (error) {
                let errorMessage = 'Unknown error';
                if (error instanceof Response) {
                    try {
                        const errorText = await error.text();
                        errorMessage = `HTTP ${error.status}: ${errorText}`;
                    }
                    catch (parseError) {
                        errorMessage = `HTTP ${error.status}: ${error.statusText}`;
                    }
                }
                else if (error instanceof Error) {
                    errorMessage = error.message;
                }
                else {
                    errorMessage = JSON.stringify(error);
                }
                this.client.logger.error(`[RADIO] API connection test failed: ${errorMessage}`);
                return false;
            }
        };
        this.client = client;
        this.api = new radio_browser_api_1.RadioBrowserApi('Pepper Music Bot');
        this.startCleanupTimer();
    }
}
exports.RadioManager = RadioManager;
RadioManager.getInstance = (client) => {
    if (!RadioManager.instance) {
        RadioManager.instance = new RadioManager(client);
    }
    return RadioManager.instance;
};
