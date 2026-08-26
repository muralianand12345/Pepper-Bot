import { PipelineStage } from 'mongoose';

import client from '../../../pepper';
import music_user from '../../../events/database/schema/music_user';
import music_guild from '../../../events/database/schema/music_guild';
import { StatsOverview, StatsPlaytime, StatsServerInsight, StatsTopRequester } from '../../../types';

const CACHE_TTL = 60 * 1000;

type CacheEntry = { value: unknown; expiresAt: number };

export class StatsDB {
	private static cache = new Map<string, CacheEntry>();
	private static inFlight = new Map<string, Promise<unknown>>();

	private static withCache = async <T>(key: string, producer: () => Promise<T>): Promise<T> => {
		const cached = this.cache.get(key);
		if (cached && cached.expiresAt > Date.now()) return cached.value as T;

		const pending = this.inFlight.get(key);
		if (pending) return pending as Promise<T>;

		const promise = producer()
			.then((value) => {
				this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
				return value;
			})
			.finally(() => {
				this.inFlight.delete(key);
			});

		this.inFlight.set(key, promise);
		return promise;
	};

	private static excludedUserIds = (): string[] => (client.user?.id ? [client.user.id] : []);

	public static isCached = (key: string): boolean => {
		const cached = this.cache.get(key);
		return !!cached && cached.expiresAt > Date.now();
	};

	public static invalidate = (key?: string): void => {
		if (key) this.cache.delete(key);
		else this.cache.clear();
	};

	public static getOverview = async (): Promise<StatsOverview> => {
		return this.withCache('overview', async () => {
			const empty: StatsOverview = { uniqueSongs: 0, totalPlays: 0, uniqueArtists: 0, estimatedPlaytimeMs: 0, activeGuilds: 0, trackedListeners: 0, songsLastPlayed24h: 0, songsLastPlayed7d: 0, lastPlayedAt: null };
			try {
				const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
				const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

				const [aggregate, activeGuilds, trackedListeners] = await Promise.all([
					music_guild
						.aggregate([
							{ $unwind: '$songs' },
							{ $match: { 'songs.played_number': { $gt: 0 } } },
							{ $group: { _id: '$songs.uri', author: { $first: '$songs.author' }, duration: { $first: '$songs.duration' }, plays: { $sum: '$songs.played_number' }, lastPlayedAt: { $max: '$songs.timestamp' } } },
							{
								$group: {
									_id: null,
									uniqueSongs: { $sum: 1 },
									totalPlays: { $sum: '$plays' },
									uniqueArtists: { $addToSet: { $toLower: '$author' } },
									estimatedPlaytimeMs: { $sum: { $multiply: ['$duration', '$plays'] } },
									songsLastPlayed24h: { $sum: { $cond: [{ $gte: ['$lastPlayedAt', day] }, 1, 0] } },
									songsLastPlayed7d: { $sum: { $cond: [{ $gte: ['$lastPlayedAt', week] }, 1, 0] } },
									lastPlayedAt: { $max: '$lastPlayedAt' },
								},
							},
							{ $project: { _id: 0, uniqueSongs: 1, totalPlays: 1, uniqueArtists: { $size: '$uniqueArtists' }, estimatedPlaytimeMs: 1, songsLastPlayed24h: 1, songsLastPlayed7d: 1, lastPlayedAt: 1 } },
						])
						.allowDiskUse(true),
					music_guild.countDocuments({ 'songs.0': { $exists: true } }),
					music_user.countDocuments({ 'songs.0': { $exists: true }, userId: { $nin: this.excludedUserIds() } }),
				]);

				if (!aggregate || aggregate.length === 0) return { ...empty, activeGuilds, trackedListeners };
				return { ...empty, ...aggregate[0], activeGuilds, trackedListeners };
			} catch (err) {
				client.logger.error(`[STATS] Error in getOverview: ${err}`);
				return empty;
			}
		});
	};

	public static getTopRequesters = async (limit: number = 10): Promise<StatsTopRequester[]> => {
		return this.withCache(`requesters:${limit}`, async () => {
			try {
				const result = await music_user
					.aggregate([
						{ $match: { userId: { $nin: this.excludedUserIds() } } },
						{ $unwind: '$songs' },
						{ $match: { 'songs.played_number': { $gt: 0 } } },
						{
							$group: {
								_id: '$userId',
								username: { $first: '$songs.requester.username' },
								avatar: { $first: '$songs.requester.avatar' },
								totalPlays: { $sum: '$songs.played_number' },
								uniqueSongs: { $sum: 1 },
								uniqueArtists: { $addToSet: { $toLower: '$songs.author' } },
								estimatedPlaytimeMs: { $sum: { $multiply: ['$songs.duration', '$songs.played_number'] } },
								lastPlayedAt: { $max: '$songs.timestamp' },
							},
						},
						{ $sort: { totalPlays: -1, uniqueSongs: -1 } },
						{ $limit: limit },
						{ $project: { _id: 0, userId: '$_id', username: 1, avatar: 1, totalPlays: 1, uniqueSongs: 1, uniqueArtists: { $size: '$uniqueArtists' }, estimatedPlaytimeMs: 1, lastPlayedAt: 1 } },
					])
					.allowDiskUse(true);

				return (result || []).map((requester, index) => ({ rank: index + 1, ...requester, username: requester.username ?? null, avatar: requester.avatar ?? null, lastPlayedAt: requester.lastPlayedAt ?? null }));
			} catch (err) {
				client.logger.error(`[STATS] Error in getTopRequesters: ${err}`);
				return [];
			}
		});
	};

	public static getPlaytime = async (limit: number = 10): Promise<StatsPlaytime> => {
		return this.withCache(`playtime:${limit}`, async () => {
			const empty: StatsPlaytime = { estimatedPlaytimeMs: 0, totalPlays: 0, trackedGuilds: 0, servers: [] };
			try {
				const result = await music_guild
					.aggregate([
						{ $unwind: '$songs' },
						{ $match: { 'songs.played_number': { $gt: 0 } } },
						{ $group: { _id: '$guildId', estimatedPlaytimeMs: { $sum: { $multiply: ['$songs.duration', '$songs.played_number'] } }, totalPlays: { $sum: '$songs.played_number' }, uniqueSongs: { $sum: 1 } } },
						{
							$facet: {
								totals: [{ $group: { _id: null, estimatedPlaytimeMs: { $sum: '$estimatedPlaytimeMs' }, totalPlays: { $sum: '$totalPlays' }, trackedGuilds: { $sum: 1 } } }],
								servers: [{ $sort: { estimatedPlaytimeMs: -1 } }, { $limit: limit }, { $project: { _id: 0, guildId: '$_id', estimatedPlaytimeMs: 1, totalPlays: 1, uniqueSongs: 1 } }],
							},
						},
					])
					.allowDiskUse(true);

				if (!result || result.length === 0) return empty;
				const totals = result[0].totals?.[0];
				return { estimatedPlaytimeMs: totals?.estimatedPlaytimeMs ?? 0, totalPlays: totals?.totalPlays ?? 0, trackedGuilds: totals?.trackedGuilds ?? 0, servers: (result[0].servers || []).map((server: Record<string, unknown>) => ({ ...server, guildName: null })) };
			} catch (err) {
				client.logger.error(`[STATS] Error in getPlaytime: ${err}`);
				return empty;
			}
		});
	};

	private static serverInsightStages = (limit?: number): PipelineStage[] => [
		{ $unwind: '$songs' },
		{ $match: { 'songs.played_number': { $gt: 0 } } },
		{
			$group: {
				_id: '$guildId',
				totalPlays: { $sum: '$songs.played_number' },
				uniqueSongs: { $sum: 1 },
				uniqueArtists: { $addToSet: { $toLower: '$songs.author' } },
				sources: { $addToSet: '$songs.sourceName' },
				estimatedPlaytimeMs: { $sum: { $multiply: ['$songs.duration', '$songs.played_number'] } },
				lastPlayedAt: { $max: '$songs.timestamp' },
				topSong: {
					$top: {
						sortBy: { 'songs.played_number': -1 },
						output: { title: '$songs.title', author: '$songs.author', uri: '$songs.uri', artworkUrl: '$songs.artworkUrl', plays: '$songs.played_number' },
					},
				},
			},
		},
		{ $sort: { totalPlays: -1, _id: 1 } },
		...(limit ? [{ $limit: limit }] : []),
		{
			$project: {
				_id: 0,
				guildId: '$_id',
				totalPlays: 1,
				uniqueSongs: 1,
				uniqueArtists: { $size: '$uniqueArtists' },
				sources: 1,
				estimatedPlaytimeMs: 1,
				lastPlayedAt: 1,
				topSong: 1,
				averagePlaysPerSong: { $cond: [{ $gt: ['$uniqueSongs', 0] }, { $divide: ['$totalPlays', '$uniqueSongs'] }, 0] },
			},
		},
	];

	private static toServerInsight = (raw: Record<string, unknown>): StatsServerInsight => ({
		guildId: String(raw.guildId),
		guildName: null,
		guildIcon: null,
		memberCount: null,
		totalPlays: Number(raw.totalPlays ?? 0),
		uniqueSongs: Number(raw.uniqueSongs ?? 0),
		uniqueArtists: Number(raw.uniqueArtists ?? 0),
		estimatedPlaytimeMs: Number(raw.estimatedPlaytimeMs ?? 0),
		averagePlaysPerSong: Number(raw.averagePlaysPerSong ?? 0),
		sources: (raw.sources as string[]) ?? [],
		topSong: (raw.topSong as StatsServerInsight['topSong']) ?? null,
		lastPlayedAt: (raw.lastPlayedAt as Date) ?? null,
		live: false,
	});

	public static getServerInsights = async (limit: number = 10): Promise<StatsServerInsight[]> => {
		return this.withCache(`servers:${limit}`, async () => {
			try {
				const result = await music_guild.aggregate(this.serverInsightStages(limit)).allowDiskUse(true);
				return (result || []).map(this.toServerInsight);
			} catch (err) {
				client.logger.error(`[STATS] Error in getServerInsights: ${err}`);
				return [];
			}
		});
	};

	public static getServerInsight = async (guildId: string): Promise<StatsServerInsight | null> => {
		return this.withCache(`server:${guildId}`, async () => {
			try {
				const result = await music_guild.aggregate([{ $match: { guildId } }, ...this.serverInsightStages()]).allowDiskUse(true);
				if (!result || result.length === 0) return null;
				return this.toServerInsight(result[0]);
			} catch (err) {
				client.logger.error(`[STATS] Error in getServerInsight: ${err}`);
				return null;
			}
		});
	};

	public static getSongTotals = async (): Promise<{ uniqueSongs: number; totalPlays: number }> => {
		const overview = await this.getOverview();
		return { uniqueSongs: overview.uniqueSongs, totalPlays: overview.totalPlays };
	};
}
