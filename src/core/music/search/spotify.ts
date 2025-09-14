import discord from 'discord.js';
import axios, { AxiosInstance } from 'axios';

import { ConfigManager } from '../../../utils/config';
import { ISongs, ICacheEntry, ICacheConfig, ISpotifyTrack, ISpotifySearchResponse, ISpotifySearchOptions } from '../../../types';

export class SpotifyService {
	private static instance: SpotifyService;
	private client: discord.Client;
	private token: string | null = null;
	private tokenExpiry: number = 0;
	private readonly clientId: string;
	private readonly clientSecret: string;
	private spotifyApi: AxiosInstance;
	private authApi: AxiosInstance;
	private cache: Map<string, ICacheEntry> = new Map();
	private cleanupTimer: NodeJS.Timeout | null = null;
	private readonly cacheConfig: ICacheConfig;
	private configManager: ConfigManager;

	private constructor(client: discord.Client) {
		this.client = client;
		this.configManager = ConfigManager.getInstance();
		this.clientId = this.configManager.getSpotifyClientId();
		this.clientSecret = this.configManager.getSpotifyClientSecret();

		this.cacheConfig = {
			enabled: client.config.music.cache.enabled,
			maxSize: client.config.music.cache.max_size,
			defaultSearchTTL: client.config.music.cache.default_search_ttl,
			defaultUrlTTL: client.config.music.cache.defaukt_url_ttl,
			cleanupInterval: client.config.music.cache.cleanup_interval,
		};

		this.spotifyApi = axios.create({ baseURL: 'https://api.spotify.com/v1', timeout: 10000, headers: { 'Content-Type': 'application/json' } });
		this.authApi = axios.create({ baseURL: 'https://accounts.spotify.com/api', timeout: 10000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

		this.setupInterceptors();
		if (this.cacheConfig.enabled) this.startCleanupTimer();
	}

	public static getInstance = (client: discord.Client): SpotifyService => {
		if (!SpotifyService.instance) SpotifyService.instance = new SpotifyService(client);
		return SpotifyService.instance;
	};

	private setupInterceptors = (): void => {
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
	};

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

	private refreshToken = async (): Promise<void> => {
		try {
			const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
			const { data } = await this.authApi.post('/token', 'grant_type=client_credentials', { headers: { Authorization: `Basic ${auth}` } });

			this.token = data.access_token;
			this.tokenExpiry = Date.now() + data.expires_in * 1000;
			this.spotifyApi.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				throw new Error(`Token refresh failed: ${error.response?.data?.error || error.message}`);
			}
			throw error;
		}
	};

	private checkToken = async (): Promise<void> => {
		if (!this.token || Date.now() >= this.tokenExpiry) await this.refreshToken();
	};

	public searchTracks = async (query: string, options: ISpotifySearchOptions = {}): Promise<ISpotifySearchResponse> => {
		const cacheKey = this.generateCacheKey('search', query, options);
		const cached = this.getCached(cacheKey);
		if (cached) return cached;

		await this.checkToken();

		try {
			const searchParams = new URLSearchParams({ q: query, type: 'track', limit: String(options.limit || 20), offset: String(options.offset || 0) });

			if (options.market) searchParams.append('market', options.market);
			if (options.includeExternal) searchParams.append('include_external', options.includeExternal);

			const { data } = await this.spotifyApi.get<ISpotifySearchResponse>(`/search?${searchParams.toString()}`);

			this.setCached(cacheKey, data, this.cacheConfig.defaultSearchTTL);
			return data;
		} catch (error) {
			this.client.logger.error(`[SPOTIFY_SEARCH] Search error: ${error}`);
			throw error;
		}
	};

	public searchTracksByArtist = async (artist: string, limit: number = 20): Promise<ISpotifyTrack[]> => {
		try {
			const query = `artist:"${artist}"`;
			const response = await this.searchTracks(query, { limit });
			return response.tracks.items;
		} catch (error) {
			this.client.logger.error(`[SPOTIFY_SEARCH] Artist search error: ${error}`);
			return [];
		}
	};

	public searchSimilarTracks = async (trackName: string, artistName: string, limit: number = 20): Promise<ISpotifyTrack[]> => {
		try {
			const query = `track:"${trackName}" artist:"${artistName}"`;
			const response = await this.searchTracks(query, { limit });
			return response.tracks.items;
		} catch (error) {
			this.client.logger.error(`[SPOTIFY_SEARCH] Similar tracks search error: ${error}`);
			return [];
		}
	};

	public searchByGenre = async (genre: string, limit: number = 20): Promise<ISpotifyTrack[]> => {
		try {
			const query = `genre:"${genre}"`;
			const response = await this.searchTracks(query, { limit });
			return response.tracks.items;
		} catch (error) {
			this.client.logger.error(`[SPOTIFY_SEARCH] Genre search error: ${error}`);
			return [];
		}
	};

	public convertSpotifyTrackToISongs = (track: ISpotifyTrack, requester?: any): ISongs => {
		return {
			track: track.name,
			artworkUrl: track.album.images[0]?.url || '',
			sourceName: 'spotify' as any,
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

	public getRecommendationsBasedOnTrack = async (seedTrack: ISongs, limit: number = 20): Promise<ISongs[]> => {
		try {
			const recommendations: ISongs[] = [];

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
		} catch (error) {
			this.client.logger.error(`[SPOTIFY_SEARCH] Get recommendations error: ${error}`);
			return [];
		}
	};

	private shuffleArray = <T>(array: T[]): T[] => {
		if (!array || array.length === 0) return [];
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	};

	public clearCache = (): void => {
		this.cache.clear();
	};

	public getCacheStats = (): { size: number; maxSize: number } => {
		return { size: this.cache.size, maxSize: this.cacheConfig.maxSize };
	};

	public destroy = (): void => {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.clearCache();
	};
}
