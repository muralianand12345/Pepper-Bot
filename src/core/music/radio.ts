import discord from 'discord.js';
import { RadioBrowserApi, Station, AdvancedStationQuery, StationSearchOrder } from 'radio-browser-api';

import { ICacheEntry } from '../../types';

export class RadioManager {
	private static instance: RadioManager;
	private client: discord.Client;
	private api: RadioBrowserApi;
	private cache: Map<string, ICacheEntry> = new Map();
	private readonly CACHE_TTL = 300000; // 5 minutes
	private readonly MAX_CACHE_SIZE = 1000;

	private constructor(client: discord.Client) {
		this.client = client;
		this.api = new RadioBrowserApi('Pepper Music Bot');
		this.startCleanupTimer();
	}

	public static getInstance = (client: discord.Client): RadioManager => {
		if (!RadioManager.instance) {
			RadioManager.instance = new RadioManager(client);
		}
		return RadioManager.instance;
	};

	private generateCacheKey = (options: AdvancedStationQuery): string => {
		return JSON.stringify(options);
	};

	private getCached = (key: string): Station[] | null => {
		const entry = this.cache.get(key);
		if (!entry) return null;

		const now = Date.now();
		if (now - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return null;
		}

		entry.lastAccessed = now;
		return entry.data;
	};

	private setCached = (key: string, data: Station[]): void => {
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

	private evictLRU = (): void => {
		let oldestKey: string | null = null;
		let oldestTime = Date.now();

		for (const [key, entry] of this.cache.entries()) {
			if (entry.lastAccessed < oldestTime) {
				oldestTime = entry.lastAccessed;
				oldestKey = key;
			}
		}
		if (oldestKey) this.cache.delete(oldestKey);
	};

	private startCleanupTimer = (): void => {
		setInterval(() => {
			const now = Date.now();
			const toDelete: string[] = [];

			for (const [key, entry] of this.cache.entries()) {
				if (now - entry.timestamp > entry.ttl) {
					toDelete.push(key);
				}
			}

			toDelete.forEach((key) => this.cache.delete(key));
		}, 60000); // Clean every minute
	};

	public searchStations = async (options: AdvancedStationQuery): Promise<Station[]> => {
		const cacheKey = this.generateCacheKey(options);
		const cached = this.getCached(cacheKey);
		if (cached) {
			this.client.logger.debug(`[RADIO] Cache hit for search: ${cacheKey}`);
			return cached;
		}

		try {
			this.client.logger.debug(`[RADIO] Searching stations with options: ${JSON.stringify(options)}`);

			const searchParams: AdvancedStationQuery = {
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
		} catch (error) {
			let errorMessage = 'Unknown error';

			if (error instanceof Response) {
				try {
					const errorText = await error.text();
					errorMessage = `HTTP ${error.status}: ${errorText}`;
				} catch (parseError) {
					errorMessage = `HTTP ${error.status}: ${error.statusText}`;
				}
			} else if (error instanceof Error) {
				errorMessage = error.message;
			} else if (typeof error === 'string') {
				errorMessage = error;
			} else {
				errorMessage = JSON.stringify(error);
			}

			this.client.logger.error(`[RADIO] Search error: ${errorMessage}`);
			return [];
		}
	};

	public getStationById = async (stationId: string): Promise<Station | null> => {
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
			} else {
				this.client.logger.debug(`[RADIO] Found station: ${station.name}`);
			}

			return station;
		} catch (error) {
			let errorMessage = 'Unknown error';

			if (error instanceof Response) {
				try {
					const errorText = await error.text();
					errorMessage = `HTTP ${error.status}: ${errorText}`;
				} catch (parseError) {
					errorMessage = `HTTP ${error.status}: ${error.statusText}`;
				}
			} else if (error instanceof Error) {
				errorMessage = error.message;
			} else if (typeof error === 'string') {
				errorMessage = error;
			} else {
				errorMessage = JSON.stringify(error);
			}

			this.client.logger.error(`[RADIO] Get station by ID error: ${errorMessage}`);
			return null;
		}
	};

	public getTopStationsByCountry = async (countryCode: string, limit: number = 10): Promise<Station[]> => {
		return this.searchStations({
			countryCode,
			limit,
		});
	};

	public getTopStationsByLanguage = async (language: string, limit: number = 10): Promise<Station[]> => {
		return this.searchStations({
			language,
			limit,
		});
	};

	public clearCache = (): void => {
		this.cache.clear();
		this.client.logger.info('[RADIO] Cache cleared');
	};

	public getCacheStats = (): { size: number; maxSize: number } => {
		return {
			size: this.cache.size,
			maxSize: this.MAX_CACHE_SIZE,
		};
	};

	public testConnection = async (): Promise<boolean> => {
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
			} else {
				this.client.logger.warn('[RADIO] API connection returned empty or invalid result');
				return false;
			}
		} catch (error) {
			let errorMessage = 'Unknown error';

			if (error instanceof Response) {
				try {
					const errorText = await error.text();
					errorMessage = `HTTP ${error.status}: ${errorText}`;
				} catch (parseError) {
					errorMessage = `HTTP ${error.status}: ${error.statusText}`;
				}
			} else if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = JSON.stringify(error);
			}

			this.client.logger.error(`[RADIO] API connection test failed: ${errorMessage}`);
			return false;
		}
	};
}
