import discord from 'discord.js';
import magmastream, { LoadTypes, TrackUtils } from 'magmastream';

import { PlaylistDB } from '../repo/playlist';
import { checkUserPremium } from '../../commands/premium';
import { IPlaylistTrack, PlaylistRecord, PlaylistSummary } from '../../../types';

export type PlaylistLimits = { isPremium: boolean; playlists: number; songs: number };
export type PlaylistLockReason = 'too_many_playlists' | 'too_many_songs';
export type PlaylistLock = { reason: PlaylistLockReason | null; limits: PlaylistLimits; ownedCount: number };
export type PlaylistPlayResult = { status: 'none' | 'not_found' | 'private' } | { status: 'empty' | 'locked'; name: string } | { status: 'ok'; playlist: PlaylistRecord };
export type PlaylistTrackSearch = { status: 'ok'; tracks: IPlaylistTrack[]; exact: boolean } | { status: 'no_results' | 'collection' };
export type PlaylistAddResult = { status: 'added'; playlist: PlaylistRecord; limits: PlaylistLimits } | { status: 'duplicate'; playlist: PlaylistRecord } | { status: 'full'; playlist: PlaylistRecord; limits: PlaylistLimits } | { status: 'locked'; playlist: PlaylistRecord; lock: PlaylistLock } | { status: 'not_found' | 'not_owner' };

export const PLAYLIST_CONFIG = {
	PLAY_VALUE_PREFIX: 'pepper-playlist:',
	NAME_MAX_LENGTH: 50,
	PAGE_SIZE: 10,
	SEARCH_RESULTS: 5,
	TRANSFER_TTL_MS: 24 * 60 * 60 * 1000,
	PENDING_TTL_MS: 10 * 60 * 1000,
	PREMIUM_CHECK_TIMEOUT_MS: 1200,
	PREMIUM_TIER_ID: 1,
	DEFAULT_LIMITS: { basic: { playlists: 1, songs: 10 }, premium: { playlists: 5, songs: 50 } },
} as const;

const YOUTUBE_REGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;

const positiveInt = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback);

export class PlaylistService {
	public static normalizeCode = (input: string | null | undefined): string | null => {
		const code = (input ?? '').trim().toUpperCase();
		return PlaylistDB.CODE_PATTERN.test(code) ? code : null;
	};

	public static toPlayValue = (code: string): string => `${PLAYLIST_CONFIG.PLAY_VALUE_PREFIX}${code}`;

	public static normalizeName = (name: string): string => name.replace(/\s+/g, ' ').trim();

	public static isValidName = (name: string): boolean => name.length > 0 && name.length <= PLAYLIST_CONFIG.NAME_MAX_LENGTH;

	public static canView = (playlist: Pick<PlaylistRecord, 'ownerId' | 'visibility'>, userId: string): boolean => playlist.visibility === 'public' || playlist.ownerId === userId;

	public static getTierLimits = (client: discord.Client, tierId: number): PlaylistLimits => {
		const isPremium = tierId > 0;
		const fallback = isPremium ? PLAYLIST_CONFIG.DEFAULT_LIMITS.premium : PLAYLIST_CONFIG.DEFAULT_LIMITS.basic;
		const feature = client.config.premium?.tiers?.find((tier) => tier.id === tierId)?.feature;
		return { isPremium, playlists: positiveInt(feature?.custom_playlists, fallback.playlists), songs: positiveInt(feature?.custom_playlist_songs, fallback.songs) };
	};

	public static getPremiumLimits = (client: discord.Client): PlaylistLimits => this.getTierLimits(client, PLAYLIST_CONFIG.PREMIUM_TIER_ID);

	public static getLimits = async (client: discord.Client, userId: string): Promise<PlaylistLimits> => {
		const { isPremium, tier } = await checkUserPremium(client, userId);
		return this.getTierLimits(client, isPremium ? tier : 0);
	};

	public static getLimitsWithin = async (client: discord.Client, userId: string, timeoutMs: number = PLAYLIST_CONFIG.PREMIUM_CHECK_TIMEOUT_MS): Promise<PlaylistLimits | null> => {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<null>((resolve) => {
			timer = setTimeout(() => resolve(null), timeoutMs);
		});
		try {
			return await Promise.race([this.getLimits(client, userId), timeout]);
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
		}
	};

	public static getLockReason = (trackCount: number, ownedCount: number, limits: PlaylistLimits): PlaylistLockReason | null => {
		if (ownedCount > limits.playlists) return 'too_many_playlists';
		if (trackCount > limits.songs) return 'too_many_songs';
		return null;
	};

	public static isSummaryLocked = (summary: Pick<PlaylistSummary, 'trackCount'>, ownedCount: number, limits: PlaylistLimits): boolean => this.getLockReason(summary.trackCount, ownedCount, limits) !== null;

	public static getLock = async (client: discord.Client, playlist: Pick<PlaylistRecord, 'ownerId' | 'tracks'>): Promise<PlaylistLock> => {
		const [limits, ownedCount] = await Promise.all([this.getLimits(client, playlist.ownerId), PlaylistDB.countByOwner(playlist.ownerId)]);
		return { reason: this.getLockReason(playlist.tracks.length, ownedCount, limits), limits, ownedCount };
	};

	public static findForUser = async (userId: string, input: string, withAudio: boolean = true): Promise<{ playlist: PlaylistRecord | null; owned: boolean }> => {
		const code = this.normalizeCode(input);
		const byCode = code ? await PlaylistDB.findByCode(code, withAudio) : null;
		if (byCode?.ownerId === userId) return { playlist: byCode, owned: true };

		const name = this.normalizeName(input);
		const byName = name ? await PlaylistDB.findByOwnerAndName(userId, name, withAudio) : null;
		if (byName) return { playlist: byName, owned: true };

		return { playlist: byCode, owned: false };
	};

	public static fromTrack = (track: magmastream.Track, addedBy: string): IPlaylistTrack | null => {
		if (!track?.track || !track.uri) return null;
		return {
			encoded: track.track,
			title: track.title || 'Unknown',
			author: track.author || 'Unknown',
			uri: track.uri,
			identifier: track.identifier || '',
			sourceName: track.sourceName || 'unknown',
			duration: Number(track.duration) || 0,
			isSeekable: Boolean(track.isSeekable),
			isStream: Boolean(track.isStream),
			isrc: track.isrc || '',
			artworkUrl: track.artworkUrl || track.thumbnail || null,
			addedBy,
			addedAt: new Date(),
		};
	};

	public static toTrack = (entry: IPlaylistTrack, requesterId: string): magmastream.Track => {
		const info = { identifier: entry.identifier, isSeekable: entry.isSeekable, author: entry.author, length: entry.duration, isrc: entry.isrc, isStream: entry.isStream, title: entry.title, uri: entry.uri, artworkUrl: entry.artworkUrl ?? undefined, sourceName: entry.sourceName as magmastream.TrackSourceName };
		return TrackUtils.build({ encoded: entry.encoded, info, pluginInfo: {} }, requesterId);
	};

	public static toPlaylistData = (playlist: PlaylistRecord, requester: discord.User): magmastream.PlaylistData => {
		const tracks = playlist.tracks.map((entry) => this.toTrack(entry, requester.id));
		const duration = tracks.reduce((total, track) => total + (track.isStream ? 0 : track.duration || 0), 0);
		return { name: playlist.name, requester: { id: requester.id, username: requester.username }, playlistInfo: [], duration, tracks };
	};

	public static isSameTrack = (a: IPlaylistTrack, b: IPlaylistTrack): boolean => a.uri === b.uri || (Boolean(a.identifier) && a.identifier === b.identifier && a.sourceName.toLowerCase() === b.sourceName.toLowerCase());

	public static resolvePlayable = async (client: discord.Client, value: string | null, userId: string): Promise<PlaylistPlayResult> => {
		const raw = (value ?? '').trim();
		const explicit = raw.toLowerCase().startsWith(PLAYLIST_CONFIG.PLAY_VALUE_PREFIX);
		const code = this.normalizeCode(explicit ? raw.slice(PLAYLIST_CONFIG.PLAY_VALUE_PREFIX.length) : raw);
		const playlist = code ? await PlaylistDB.findByCode(code) : null;

		if (!playlist) return { status: explicit ? 'not_found' : 'none' };
		if (!this.canView(playlist, userId)) return { status: explicit ? 'private' : 'none' };
		if (playlist.tracks.length === 0) return { status: 'empty', name: playlist.name };

		const lock = await this.getLock(client, playlist);
		return lock.reason ? { status: 'locked', name: playlist.name } : { status: 'ok', playlist };
	};

	public static addTrack = async (client: discord.Client, userId: string, code: string, entry: IPlaylistTrack, allowDuplicate: boolean): Promise<PlaylistAddResult> => {
		const playlist = await PlaylistDB.findByCode(code, false);
		if (!playlist) return { status: 'not_found' };
		if (playlist.ownerId !== userId) return { status: 'not_owner' };

		const lock = await this.getLock(client, playlist);
		if (lock.reason) return { status: 'locked', playlist, lock };
		if (playlist.tracks.length >= lock.limits.songs) return { status: 'full', playlist, limits: lock.limits };
		if (!allowDuplicate && playlist.tracks.some((track) => this.isSameTrack(track, entry))) return { status: 'duplicate', playlist };

		const updated = await PlaylistDB.addTrack(code, userId, { ...entry, addedBy: userId, addedAt: new Date() }, lock.limits.songs);
		if (updated) return { status: 'added', playlist: updated, limits: lock.limits };

		const latest = await PlaylistDB.findByCode(code, false);
		if (!latest) return { status: 'not_found' };
		if (latest.ownerId !== userId) return { status: 'not_owner' };
		return { status: 'full', playlist: latest, limits: lock.limits };
	};

	public static searchTracks = async (client: discord.Client, query: string, userId: string): Promise<PlaylistTrackSearch> => {
		let search = query.trim();
		if (YOUTUBE_REGEX.test(search)) {
			const youtube = await client.manager.search(search, userId);
			if (TrackUtils.isErrorOrEmptySearchResult(youtube) || !('tracks' in youtube) || youtube.tracks.length === 0) return { status: 'no_results' };
			search = `spsearch:${youtube.tracks[0].title} ${youtube.tracks[0].author}`;
		}

		const result = await client.manager.search(search, userId);
		if (TrackUtils.isErrorOrEmptySearchResult(result)) return { status: 'no_results' };
		if (result.loadType !== LoadTypes.Track && result.loadType !== LoadTypes.Search) return { status: 'collection' };

		const seen = new Set<string>();
		const tracks = result.tracks
			.map((track) => this.fromTrack(track, userId))
			.filter((entry): entry is IPlaylistTrack => {
				if (!entry || seen.has(entry.uri)) return false;
				seen.add(entry.uri);
				return true;
			})
			.slice(0, PLAYLIST_CONFIG.SEARCH_RESULTS);

		return tracks.length > 0 ? { status: 'ok', tracks, exact: result.loadType === LoadTypes.Track } : { status: 'no_results' };
	};
}
