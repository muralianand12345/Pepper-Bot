import discord from 'discord.js';
import axios, { AxiosInstance } from 'axios';

import { IAutoCompleteOptions, ISpotifySearchResult, ICacheEntry, ICacheConfig } from '../../../types';

export class SpotifyAutoComplete {
	private client: discord.Client;
	private token: string | null = null;
	private tokenExpiry: number = 0;
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly defaultOptions: IAutoCompleteOptions;
	private spotifyApi: AxiosInstance;
	private authApi: AxiosInstance;
	private cache: Map<string, ICacheEntry> = new Map();
	private cleanupTimer: NodeJS.Timeout | null = null;
	private readonly cacheConfig: ICacheConfig;

	constructor(client: discord.Client, clientId: string, clientSecret: string, searchLanguage: string, cacheConfig?: Partial<ICacheConfig>) {
		this.client = client;
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.defaultOptions = { maxResults: 7, language: searchLanguage };

		this.cacheConfig = {
			enabled: client.config.music.cache.enabled,
			maxSize: client.config.music.cache.max_size,
			defaultSearchTTL: client.config.music.cache.default_search_ttl,
			defaultUrlTTL: client.config.music.cache.defaukt_url_ttl,
			cleanupInterval: client.config.music.cache.cleanup_interval,
			...cacheConfig,
		};

		this.spotifyApi = axios.create({
			baseURL: 'https://api.spotify.com/v1',
			timeout: 10000,
			headers: { 'Content-Type': 'application/json' },
		});
		this.authApi = axios.create({
			baseURL: 'https://accounts.spotify.com/api',
			timeout: 10000,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		});

		this.spotifyApi.interceptors.response.use(
			(response) => response,
			async (error) => {
				if (axios.isAxiosError(error)) {
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
			}
		);
		if (this.cacheConfig.enabled) this.startCleanupTimer();
	}

	private generateCacheKey = (type: string, query: string, options?: any): string => {
		const optionsStr = options ? JSON.stringify(options) : '';
		return `${type}:${query}:${optionsStr}`;
	};

	private getCached = (key: string): any | null => {
		if (!this.cacheConfig.enabled) return null;
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

	private setCached = (key: string, data: any, ttl: number): void => {
		if (!this.cacheConfig.enabled) return;
		const now = Date.now();
		if (this.cache.size >= this.cacheConfig.maxSize) this.evictLRU();
		this.cache.set(key, { data, timestamp: now, lastAccessed: now, ttl });
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

	private cleanup = (): void => {
		if (!this.cacheConfig.enabled) return;

		const now = Date.now();
		const toDelete: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > entry.ttl) toDelete.push(key);
		}

		toDelete.forEach((key) => this.cache.delete(key));
	};

	private startCleanupTimer = (): void => {
		if (this.cleanupTimer) clearInterval(this.cleanupTimer);
		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.cacheConfig.cleanupInterval);
	};

	public clearCache = (): void => {
		this.cache.clear();
	};

	public getCacheStats = (): {
		size: number;
		maxSize: number;
		hitRate?: number;
	} => {
		return { size: this.cache.size, maxSize: this.cacheConfig.maxSize };
	};

	public destroy = (): void => {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.clearCache();
	};

	private refreshToken = async (): Promise<void> => {
		try {
			const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
			const { data } = await this.authApi.post('/token', 'grant_type=client_credentials', { headers: { Authorization: `Basic ${auth}` } });

			this.token = data.access_token;
			this.tokenExpiry = Date.now() + data.expires_in * 1000;
			this.spotifyApi.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
		} catch (error) {
			if (axios.isAxiosError(error)) throw new Error(`Token refresh failed: ${error.response?.data?.error || error.message}`);
			throw error;
		}
	};

	private checkToken = async (): Promise<void> => {
		if (!this.token || Date.now() >= this.tokenExpiry) await this.refreshToken();
	};

	private getSpotifyIdFromUrl = (url: string): { type: string; id: string } | null => {
		try {
			const urlObj = new URL(url);
			if (!urlObj.hostname.includes('spotify.com')) return null;

			const pathParts = urlObj.pathname.split('/');
			if (pathParts.length < 3) return null;

			const type = pathParts[1];
			const id = pathParts[2].split('?')[0];

			if (!['track', 'album', 'playlist', 'artist'].includes(type)) return null;
			return { type, id };
		} catch (error) {
			return null;
		}
	};

	private getMetadataFromUrl = async (url: string): Promise<discord.ApplicationCommandOptionChoiceData> => {
		const cacheKey = this.generateCacheKey('url', url);
		const cached = this.getCached(cacheKey);
		if (cached) return cached;

		await this.checkToken();

		const urlInfo = this.getSpotifyIdFromUrl(url);
		if (!urlInfo) {
			const result = { name: url, value: url };
			this.setCached(cacheKey, result, this.cacheConfig.defaultUrlTTL);
			return result;
		}

		try {
			const { data } = await this.spotifyApi.get(`/${urlInfo.type}s/${urlInfo.id}`);
			let name = '';

			switch (urlInfo.type) {
				case 'track':
					name = `${data.name} - ${data.artists[0].name}`;
					break;
				case 'album':
					name = `Album: ${data.name} - ${data.artists[0].name}`;
					break;
				case 'playlist':
					name = `Playlist: ${data.name} by ${data.owner.display_name}`;
					break;
				case 'artist':
					name = `Artist: ${data.name}`;
					break;
				default:
					name = 'Unknown Spotify Content';
			}

			const result = { name: name.slice(0, 100), value: url };
			this.setCached(cacheKey, result, this.cacheConfig.defaultUrlTTL);
			return result;
		} catch (error) {
			let result: discord.ApplicationCommandOptionChoiceData;
			if (axios.isAxiosError(error) && error.response?.status === 404) {
				result = { name: 'Invalid Spotify URL', value: url };
			} else {
				result = { name: 'Error fetching Spotify metadata', value: url };
			}
			this.setCached(cacheKey, result, this.cacheConfig.defaultUrlTTL);
			return result;
		}
	};

	public getSuggestions = async (query: string, options: IAutoCompleteOptions = {}): Promise<discord.ApplicationCommandOptionChoiceData[]> => {
		if (!query?.trim()) return [];

		const maxResults = options.maxResults || this.defaultOptions.maxResults;
		const cacheKey = this.generateCacheKey('search', query.toLowerCase(), {
			maxResults,
		});
		const cached = this.getCached(cacheKey);
		if (cached) return cached;

		await this.checkToken();

		try {
			if (query.startsWith('https://')) {
				const metadata = await this.getMetadataFromUrl(query);
				const result = [metadata];
				this.setCached(cacheKey, result, this.cacheConfig.defaultUrlTTL);
				return result;
			}

			const { data } = await this.spotifyApi.get<ISpotifySearchResult>('/search', {
				params: { q: query, type: 'track', limit: maxResults },
			});

			const result = data.tracks.items.map((track) => ({
				name: `${track.name} - ${track.artists[0].name}`.slice(0, 100),
				value: track.external_urls.spotify,
			}));

			this.setCached(cacheKey, result, this.cacheConfig.defaultSearchTTL);
			return result;
		} catch (error) {
			this.client.logger.warn(`[AUTO_SEARCH] Spotify Autocomplete error: ${error}`);
			const result: discord.ApplicationCommandOptionChoiceData[] = [];
			this.setCached(cacheKey, result, this.cacheConfig.defaultSearchTTL);
			return result;
		}
	};
}
