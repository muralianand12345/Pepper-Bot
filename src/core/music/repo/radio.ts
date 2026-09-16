import mongoose from 'mongoose';

import client from '../../../pepper';
import radio_user from '../../../events/database/schema/radio_user';
import radio_guild from '../../../events/database/schema/radio_guild';
import { IRadioStationEntry, ISongsUser, RadioStation, RadioSummary, RadioTopStation } from '../../../types';


export class RadioDB {
	private static buildEntry = (station: RadioStation, requester: ISongsUser | null, now: Date): IRadioStationEntry => ({
		stationId: station.id,
		name: station.name,
		genre: station.genre,
		country: station.country,
		url: station.url,
		artworkUrl: station.artworkUrl,
		codec: station.codec,
		bitrate: station.bitrate,
		source: station.source,
		played_number: 1,
		total_duration_ms: 0,
		reconnect_count: 0,
		failure_count: 0,
		last_requester: requester,
		first_played: now,
		last_played: now,
	});

	private static touch = async <T>(model: mongoose.Model<T>, filter: mongoose.QueryFilter<T>, station: RadioStation, requester: ISongsUser | null): Promise<void> => {
		const now = new Date();
		const set: Record<string, unknown> = {
			'stations.$.last_played': now,
			'stations.$.name': station.name,
			'stations.$.genre': station.genre,
			'stations.$.url': station.url,
			'stations.$.artworkUrl': station.artworkUrl,
		};
		if (requester) set['stations.$.last_requester'] = requester;

		const updated = await model.updateOne({ ...filter, 'stations.stationId': station.id }, { $inc: { 'stations.$.played_number': 1, total_sessions: 1 }, $set: set });
		if (updated.matchedCount > 0) return;

		await model.updateOne(filter, { $inc: { total_sessions: 1 }, $setOnInsert: { total_listen_ms: 0 } }, { upsert: true });
		await model.updateOne({ ...filter, 'stations.stationId': { $ne: station.id } }, { $push: { stations: RadioDB.buildEntry(station, requester, now) } });
	};

	public static startSession = async (guildId: string | null, requester: ISongsUser | null, station: RadioStation): Promise<void> => {
		try {
			const tasks: Promise<void>[] = [];
			if (guildId) tasks.push(RadioDB.touch(radio_guild, { guildId }, station, requester));
			if (requester?.id) tasks.push(RadioDB.touch(radio_user, { userId: requester.id }, station, requester));
			await Promise.all(tasks);
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to start session for guild ${guildId}: ${error}`);
		}
	};

	public static addDuration = async (guildId: string | null, userId: string | null, stationId: string, durationMs: number): Promise<void> => {
		if (durationMs <= 0) return;
		try {
			const tasks: Promise<unknown>[] = [];
			if (guildId) tasks.push(radio_guild.updateOne({ guildId, 'stations.stationId': stationId }, { $inc: { 'stations.$.total_duration_ms': durationMs, total_listen_ms: durationMs } }));
			if (userId) tasks.push(radio_user.updateOne({ userId, 'stations.stationId': stationId }, { $inc: { 'stations.$.total_duration_ms': durationMs, total_listen_ms: durationMs } }));
			await Promise.all(tasks);
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to add ${durationMs}ms for station ${stationId}: ${error}`);
		}
	};

	private static bumpCounter = async (guildId: string | null, stationId: string, field: 'reconnect_count' | 'failure_count'): Promise<void> => {
		if (!guildId) return;
		try {
			await radio_guild.updateOne({ guildId, 'stations.stationId': stationId }, { $inc: { [`stations.$.${field}`]: 1 } });
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to bump ${field} for station ${stationId}: ${error}`);
		}
	};

	public static recordReconnect = async (guildId: string | null, stationId: string): Promise<void> => RadioDB.bumpCounter(guildId, stationId, 'reconnect_count');

	public static recordFailure = async (guildId: string | null, stationId: string): Promise<void> => RadioDB.bumpCounter(guildId, stationId, 'failure_count');

	private static toTop = (entries: IRadioStationEntry[], limit: number): RadioTopStation[] =>
		[...entries]
			.sort((a, b) => (b.total_duration_ms || 0) - (a.total_duration_ms || 0) || (b.played_number || 0) - (a.played_number || 0))
			.slice(0, limit)
			.map((entry, index) => ({
				rank: index + 1,
				stationId: entry.stationId,
				name: entry.name,
				genre: entry.genre,
				country: entry.country,
				artworkUrl: entry.artworkUrl,
				source: entry.source,
				playCount: entry.played_number,
				totalDurationMs: entry.total_duration_ms,
				lastPlayed: entry.last_played,
			}));

	private static summarize = (entries: IRadioStationEntry[], totalListenMs: number, totalSessions: number): RadioSummary => {
		const genres = new Map<string, number>();
		for (const entry of entries) {
			if (!entry.genre) continue;
			genres.set(entry.genre, (genres.get(entry.genre) ?? 0) + (entry.played_number || 0));
		}
		const topGenre = [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

		return {
			uniqueStations: entries.length,
			totalPlays: entries.reduce((acc, entry) => acc + (entry.played_number || 0), 0),
			totalListenMs,
			totalSessions,
			topGenre,
			countries: new Set(entries.map((entry) => entry.country).filter(Boolean)).size,
		};
	};

	public static getGuildSummary = async (guildId: string): Promise<RadioSummary | null> => {
		try {
			const doc = await radio_guild.findOne({ guildId }).lean();
			if (!doc?.stations?.length) return null;
			return RadioDB.summarize(doc.stations, doc.total_listen_ms || 0, doc.total_sessions || 0);
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to summarize guild ${guildId}: ${error}`);
			return null;
		}
	};

	public static getUserSummary = async (userId: string): Promise<RadioSummary | null> => {
		try {
			const doc = await radio_user.findOne({ userId }).lean();
			if (!doc?.stations?.length) return null;
			return RadioDB.summarize(doc.stations, doc.total_listen_ms || 0, doc.total_sessions || 0);
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to summarize user ${userId}: ${error}`);
			return null;
		}
	};

	public static getGlobalSummary = async (): Promise<RadioSummary | null> => {
		try {
			const [row] = await radio_guild.aggregate<{ uniqueStations: number; totalPlays: number; totalListenMs: number; totalSessions: number; countries: number; genres: { genre: string; plays: number }[] }>([
				{ $unwind: '$stations' },
				{ $group: { _id: '$stations.stationId', plays: { $sum: '$stations.played_number' }, duration: { $sum: '$stations.total_duration_ms' }, genre: { $last: '$stations.genre' }, country: { $last: '$stations.country' } } },
				{
					$group: {
						_id: null,
						uniqueStations: { $sum: 1 },
						totalPlays: { $sum: '$plays' },
						totalListenMs: { $sum: '$duration' },
						countries: { $addToSet: '$country' },
						genres: { $push: { genre: '$genre', plays: '$plays' } },
					},
				},
				{ $project: { uniqueStations: 1, totalPlays: 1, totalListenMs: 1, totalSessions: '$totalPlays', countries: { $size: { $filter: { input: '$countries', cond: { $ne: ['$$this', null] } } } }, genres: 1 } },
			]);

			if (!row) return null;

			const genres = new Map<string, number>();
			for (const entry of row.genres || []) {
				if (!entry?.genre) continue;
				genres.set(entry.genre, (genres.get(entry.genre) ?? 0) + (entry.plays || 0));
			}

			return { uniqueStations: row.uniqueStations, totalPlays: row.totalPlays, totalListenMs: row.totalListenMs, totalSessions: row.totalSessions, topGenre: [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, countries: row.countries };
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to compute global summary: ${error}`);
			return null;
		}
	};

	public static getGuildTopStations = async (guildId: string, limit: number = 10): Promise<RadioTopStation[]> => {
		try {
			const doc = await radio_guild.findOne({ guildId }).lean();
			return doc?.stations?.length ? RadioDB.toTop(doc.stations, limit) : [];
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to read top stations for guild ${guildId}: ${error}`);
			return [];
		}
	};

	public static getUserTopStations = async (userId: string, limit: number = 10): Promise<RadioTopStation[]> => {
		try {
			const doc = await radio_user.findOne({ userId }).lean();
			return doc?.stations?.length ? RadioDB.toTop(doc.stations, limit) : [];
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to read top stations for user ${userId}: ${error}`);
			return [];
		}
	};

	public static getGlobalTopStations = async (limit: number = 10): Promise<RadioTopStation[]> => {
		try {
			const rows = await radio_guild.aggregate<{ _id: string; name: string; genre: string; country: string | null; artworkUrl: string | null; source: RadioStation['source']; playCount: number; totalDurationMs: number; lastPlayed: Date }>([
				{ $unwind: '$stations' },
				{
					$group: {
						_id: '$stations.stationId',
						name: { $last: '$stations.name' },
						genre: { $last: '$stations.genre' },
						country: { $last: '$stations.country' },
						artworkUrl: { $last: '$stations.artworkUrl' },
						source: { $last: '$stations.source' },
						playCount: { $sum: '$stations.played_number' },
						totalDurationMs: { $sum: '$stations.total_duration_ms' },
						lastPlayed: { $max: '$stations.last_played' },
					},
				},
				{ $sort: { totalDurationMs: -1, playCount: -1 } },
				{ $limit: limit },
			]);

			return rows.map((row, index) => ({ rank: index + 1, stationId: row._id, name: row.name, genre: row.genre, country: row.country, artworkUrl: row.artworkUrl, source: row.source, playCount: row.playCount, totalDurationMs: row.totalDurationMs, lastPlayed: row.lastPlayed }));
		} catch (error) {
			client.logger?.warn(`[RADIO_DB] Failed to read global top stations: ${error}`);
			return [];
		}
	};
}
