import axios from 'axios';

import { AutoplaySongRef } from '../../../types';
import { ConfigManager } from '../../../utils/config';
import { normalizeText, normalizeTitle, primaryArtist } from './match';

const configManager = ConfigManager.getInstance();

const HOUR = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const TAG_LIMIT = 8;
const TAG_STOPLIST = new Set(['seenlive', 'all', 'favorites', 'favourites', 'favorite', 'favourite', 'myfavorite', 'awesome', 'love', 'beautiful', 'amazing', 'cool', 'good', 'best', 'spotify', 'under2000listeners']);

export interface SimilarTrack extends AutoplaySongRef {
	match: number;
	duration: number | null;
}

export interface DeezerTrack extends AutoplaySongRef {
	deezerId: number;
	duration: number | null;
}

class TtlCache<T> {
	private entries = new Map<string, { value: T; expiresAt: number }>();
	private readonly ttlMs: number;
	private readonly maxSize: number;

	constructor(ttlMs: number, maxSize: number = 2000) {
		this.ttlMs = ttlMs;
		this.maxSize = maxSize;
	}

	public get = (key: string): T | undefined => {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= Date.now()) {
			this.entries.delete(key);
			return undefined;
		}
		return entry.value;
	};

	public set = (key: string, value: T): void => {
		if (this.entries.size >= this.maxSize) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
	};

	public wrap = async (key: string, producer: () => Promise<T>): Promise<T> => {
		const cached = this.get(key);
		if (cached !== undefined) return cached;
		const value = await producer();
		this.set(key, value);
		return value;
	};
}

const lastfm = axios.create({ baseURL: 'https://ws.audioscrobbler.com/2.0/', timeout: REQUEST_TIMEOUT_MS });
const deezer = axios.create({ baseURL: 'https://api.deezer.com', timeout: REQUEST_TIMEOUT_MS });

const similarCache = new TtlCache<SimilarTrack[]>(6 * HOUR);
const tagCache = new TtlCache<Map<string, number>>(24 * HOUR, 5000);
const deezerArtistCache = new TtlCache<number | null>(24 * HOUR, 5000);
const deezerRadioCache = new TtlCache<DeezerTrack[]>(HOUR);

const LASTFM_NOT_FOUND = 6;
const DEEZER_NO_DATA = 800;

const lastfmGet = async <T>(params: Record<string, string | number>): Promise<T | null> => {
	const response = await lastfm.get('', { params: { ...params, api_key: configManager.getLastFmApiKey(), format: 'json', autocorrect: 1 }, validateStatus: () => true });
	const error = response.data?.error;
	if (error === LASTFM_NOT_FOUND) return null;
	if (error || response.status >= 400) throw new Error(`Last.fm ${error ?? response.status}: ${response.data?.message ?? 'request failed'}`);
	return response.data as T;
};

const deezerGet = async <T>(url: string, params?: Record<string, string | number>): Promise<T | null> => {
	const response = await deezer.get(url, { params });
	const error = response.data?.error;
	if (error?.code === DEEZER_NO_DATA) return null;
	if (error) throw new Error(`Deezer ${error.code}: ${error.message}`);
	return response.data as T;
};

const toSeconds = (value: unknown): number | null => {
	const num = Number(value);
	return Number.isFinite(num) && num > 0 ? num : null;
};

export const lastfmSimilarTracks = async (ref: AutoplaySongRef, limit: number = 25): Promise<SimilarTrack[]> => {
	const key = `${normalizeTitle(ref.title)}|${primaryArtist(ref.artist)}`;
	return similarCache.wrap(key, async () => {
		type Response = { similartracks?: { track?: Array<{ name: string; match: string; duration?: string; artist?: { name?: string } }> } };
		const data = await lastfmGet<Response>({ method: 'track.getSimilar', artist: ref.artist, track: ref.title, limit });
		return (data?.similartracks?.track ?? []).filter((track) => track.name && track.artist?.name).map((track) => ({ title: track.name, artist: track.artist!.name!, match: Math.min(1, Math.max(0, Number(track.match) || 0)), duration: toSeconds(track.duration) }));
	});
};

export const lastfmArtistTags = async (artist: string): Promise<Map<string, number>> => {
	const key = primaryArtist(artist);
	if (!key) return new Map();
	return tagCache.wrap(key, async () => {
		type Response = { toptags?: { tag?: Array<{ name: string; count: number | string }> } };
		const data = await lastfmGet<Response>({ method: 'artist.getTopTags', artist });
		const tags = new Map<string, number>();
		for (const tag of data?.toptags?.tag ?? []) {
			const name = normalizeText(tag.name);
			const weight = Number(tag.count) / 100;
			if (!name || TAG_STOPLIST.has(name) || /^\d+$/.test(name) || !(weight >= 0.05)) continue;
			tags.set(name, Math.min(1, weight));
			if (tags.size >= TAG_LIMIT) break;
		}
		return tags;
	});
};

type DeezerTrackPayload = { id: number; title: string; duration?: number; artist?: { id: number; name: string } };

const toDeezerTrack = (track: DeezerTrackPayload): DeezerTrack | null => (track?.id && track.title && track.artist?.name ? { deezerId: track.id, title: track.title, artist: track.artist.name, duration: toSeconds(track.duration) } : null);

const deezerArtistId = async (ref: AutoplaySongRef): Promise<number | null> => {
	const artistKey = primaryArtist(ref.artist);
	if (!artistKey) return null;
	return deezerArtistCache.wrap(artistKey, async () => {
		const tracks = await deezerGet<{ data?: DeezerTrackPayload[] }>('/search', { q: `${ref.artist} ${ref.title}`, limit: 10 });
		const byTrack = (tracks?.data ?? []).find((track) => track.artist && primaryArtist(track.artist.name) === artistKey);
		if (byTrack?.artist) return byTrack.artist.id;

		const artists = await deezerGet<{ data?: Array<{ id: number; name: string }> }>('/search/artist', { q: ref.artist, limit: 5 });
		const byName = (artists?.data ?? []).find((artist) => primaryArtist(artist.name) === artistKey);
		return byName?.id ?? null;
	});
};

export const deezerArtistRadio = async (ref: AutoplaySongRef): Promise<DeezerTrack[]> => {
	const artistId = await deezerArtistId(ref);
	if (!artistId) return [];
	return deezerRadioCache.wrap(String(artistId), async () => {
		const radio = await deezerGet<{ data?: DeezerTrackPayload[] }>(`/artist/${artistId}/radio`, { limit: 25 });
		return (radio?.data ?? []).map(toDeezerTrack).filter((track): track is DeezerTrack => track !== null);
	});
};

export const tagSimilarity = (a: Map<string, number>, b: Map<string, number>): number => {
	if (!a.size || !b.size) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (const [tag, weight] of a) {
		normA += weight * weight;
		const other = b.get(tag);
		if (other) dot += weight * other;
	}
	for (const weight of b.values()) normB += weight * weight;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};
