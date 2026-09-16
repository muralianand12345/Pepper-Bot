import discord from 'discord.js';
import axios, { AxiosInstance } from 'axios';

import { version } from '../../../../../package.json';
import { ICacheConfig, ICacheEntry, IRadioBrowserServer, IRadioBrowserStation, RadioSearchOptions, RadioStation } from '../../../../types';

const FALLBACK_HOST = 'https://de1.api.radio-browser.info';
const SERVER_LIST_URL = 'https://all.api.radio-browser.info/json/servers';
const SERVER_TTL_MS = 60 * 60 * 1000;

export class RadioBrowser {
	private readonly client: discord.Client;
	private readonly http: AxiosInstance;
	private readonly cacheConfig: ICacheConfig;
	private cache: Map<string, ICacheEntry> = new Map();

	private static host: string | null = null;
	private static hostResolvedAt = 0;
	private static hostPromise: Promise<string> | null = null;

	constructor(client: discord.Client) {
		this.client = client;
		this.cacheConfig = {
			enabled: client.config.music.cache.enabled,
			maxSize: client.config.music.cache.max_size,
			defaultSearchTTL: client.config.music.cache.default_search_ttl,
			defaultUrlTTL: client.config.music.cache.defaukt_url_ttl,
			cleanupInterval: client.config.music.cache.cleanup_interval,
		};
		this.http = axios.create({ timeout: 8000, headers: { 'User-Agent': `PepperBot/${version} (+https://github.com/muralianand12345/Pepper-Bot)` } });
	}

	private resolveHost = async (): Promise<string> => {
		if (RadioBrowser.host && Date.now() - RadioBrowser.hostResolvedAt < SERVER_TTL_MS) return RadioBrowser.host;
		if (RadioBrowser.hostPromise) return RadioBrowser.hostPromise;

		RadioBrowser.hostPromise = (async () => {
			try {
				const { data } = await this.http.get<IRadioBrowserServer[]>(SERVER_LIST_URL);
				const names = [...new Set((data || []).map((server) => server.name).filter(Boolean))];
				const host = names.length ? `https://${names[Math.floor(Math.random() * names.length)]}` : FALLBACK_HOST;
				RadioBrowser.host = host;
				RadioBrowser.hostResolvedAt = Date.now();
				this.client.logger.debug(`[RADIO_BROWSER] Using mirror ${host}`);
				return host;
			} catch (error) {
				this.client.logger.warn(`[RADIO_BROWSER] Server discovery failed, falling back to ${FALLBACK_HOST}: ${error}`);
				RadioBrowser.host = FALLBACK_HOST;
				RadioBrowser.hostResolvedAt = Date.now();
				return FALLBACK_HOST;
			} finally {
				RadioBrowser.hostPromise = null;
			}
		})();

		return RadioBrowser.hostPromise;
	};

	private getCached = <T>(key: string): T | null => {
		if (!this.cacheConfig.enabled) return null;
		const entry = this.cache.get(key);
		if (!entry) return null;
		if (Date.now() - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return null;
		}
		entry.lastAccessed = Date.now();
		return entry.data as T;
	};

	private setCached = <T>(key: string, data: T, ttl: number): void => {
		if (!this.cacheConfig.enabled) return;
		if (this.cache.size >= this.cacheConfig.maxSize) {
			let oldestKey: string | null = null;
			let oldestTime = Date.now();
			for (const [entryKey, entry] of this.cache.entries()) {
				if (entry.lastAccessed < oldestTime) {
					oldestTime = entry.lastAccessed;
					oldestKey = entryKey;
				}
			}
			if (oldestKey) this.cache.delete(oldestKey);
		}
		const now = Date.now();
		this.cache.set(key, { data, timestamp: now, lastAccessed: now, ttl });
	};

	private toStation = (raw: IRadioBrowserStation): RadioStation | null => {
		if (!raw?.stationuuid || !raw.url_resolved) return null;
		if (raw.lastcheckok !== 1 || raw.ssl_error) return null;

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

	public search = async (query: string, options: RadioSearchOptions = {}): Promise<RadioStation[]> => {
		const trimmed = query.trim();
		if (!trimmed) return [];

		const limit = options.limit ?? 20;
		const cacheKey = `search:${trimmed.toLowerCase()}:${options.countryCode ?? ''}:${limit}`;
		const cached = this.getCached<RadioStation[]>(cacheKey);
		if (cached) return cached;

		try {
			const host = await this.resolveHost();
			const params: Record<string, string | number> = { name: trimmed, limit, hidebroken: 'true', order: 'votes', reverse: 'true' };
			if (options.countryCode) params.countrycode = options.countryCode;

			const { data } = await this.http.get<IRadioBrowserStation[]>(`${host}/json/stations/search`, { params });
			const stations = (data || []).map(this.toStation).filter((station): station is RadioStation => station !== null);
			this.setCached(cacheKey, stations, this.cacheConfig.defaultSearchTTL);
			return stations;
		} catch (error) {
			this.client.logger.warn(`[RADIO_BROWSER] Search failed for "${trimmed}": ${error}`);
			return [];
		}
	};

	public getByUuid = async (uuid: string): Promise<RadioStation | null> => {
		const cacheKey = `uuid:${uuid}`;
		const cached = this.getCached<RadioStation>(cacheKey);
		if (cached) return cached;

		try {
			const host = await this.resolveHost();
			const { data } = await this.http.get<IRadioBrowserStation[]>(`${host}/json/stations/byuuid/${encodeURIComponent(uuid)}`);
			const station = data?.length ? this.toStation(data[0]) : null;
			if (station) this.setCached(cacheKey, station, this.cacheConfig.defaultUrlTTL);
			return station;
		} catch (error) {
			this.client.logger.warn(`[RADIO_BROWSER] Lookup failed for ${uuid}: ${error}`);
			return null;
		}
	};

	public reportClick = (uuid: string): void => {
		void this.resolveHost()
			.then((host) => this.http.get(`${host}/json/url/${encodeURIComponent(uuid)}`))
			.catch((error) => this.client.logger.debug(`[RADIO_BROWSER] Click report failed for ${uuid}: ${error}`));
	};
}
