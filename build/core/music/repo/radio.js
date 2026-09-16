"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioDB = void 0;
const pepper_1 = __importDefault(require("../../../pepper"));
const radio_user_1 = __importDefault(require("../../../events/database/schema/radio_user"));
const radio_guild_1 = __importDefault(require("../../../events/database/schema/radio_guild"));
class RadioDB {
}
exports.RadioDB = RadioDB;
_a = RadioDB;
RadioDB.buildEntry = (station, requester, now) => ({
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
RadioDB.touch = async (model, filter, station, requester) => {
    const now = new Date();
    const set = {
        'stations.$.last_played': now,
        'stations.$.name': station.name,
        'stations.$.genre': station.genre,
        'stations.$.url': station.url,
        'stations.$.artworkUrl': station.artworkUrl,
    };
    if (requester)
        set['stations.$.last_requester'] = requester;
    const updated = await model.updateOne({ ...filter, 'stations.stationId': station.id }, { $inc: { 'stations.$.played_number': 1, total_sessions: 1 }, $set: set });
    if (updated.matchedCount > 0)
        return;
    await model.updateOne(filter, { $inc: { total_sessions: 1 }, $setOnInsert: { total_listen_ms: 0 } }, { upsert: true });
    await model.updateOne({ ...filter, 'stations.stationId': { $ne: station.id } }, { $push: { stations: _a.buildEntry(station, requester, now) } });
};
RadioDB.startSession = async (guildId, requester, station) => {
    try {
        const tasks = [];
        if (guildId)
            tasks.push(_a.touch(radio_guild_1.default, { guildId }, station, requester));
        if (requester?.id)
            tasks.push(_a.touch(radio_user_1.default, { userId: requester.id }, station, requester));
        await Promise.all(tasks);
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to start session for guild ${guildId}: ${error}`);
    }
};
RadioDB.addDuration = async (guildId, userId, stationId, durationMs) => {
    if (durationMs <= 0)
        return;
    try {
        const tasks = [];
        if (guildId)
            tasks.push(radio_guild_1.default.updateOne({ guildId, 'stations.stationId': stationId }, { $inc: { 'stations.$.total_duration_ms': durationMs, total_listen_ms: durationMs } }));
        if (userId)
            tasks.push(radio_user_1.default.updateOne({ userId, 'stations.stationId': stationId }, { $inc: { 'stations.$.total_duration_ms': durationMs, total_listen_ms: durationMs } }));
        await Promise.all(tasks);
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to add ${durationMs}ms for station ${stationId}: ${error}`);
    }
};
RadioDB.bumpCounter = async (guildId, stationId, field) => {
    if (!guildId)
        return;
    try {
        await radio_guild_1.default.updateOne({ guildId, 'stations.stationId': stationId }, { $inc: { [`stations.$.${field}`]: 1 } });
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to bump ${field} for station ${stationId}: ${error}`);
    }
};
RadioDB.recordReconnect = async (guildId, stationId) => _a.bumpCounter(guildId, stationId, 'reconnect_count');
RadioDB.recordFailure = async (guildId, stationId) => _a.bumpCounter(guildId, stationId, 'failure_count');
RadioDB.toTop = (entries, limit) => [...entries]
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
RadioDB.summarize = (entries, totalListenMs, totalSessions) => {
    const genres = new Map();
    for (const entry of entries) {
        if (!entry.genre)
            continue;
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
RadioDB.getGuildSummary = async (guildId) => {
    try {
        const doc = await radio_guild_1.default.findOne({ guildId }).lean();
        if (!doc?.stations?.length)
            return null;
        return _a.summarize(doc.stations, doc.total_listen_ms || 0, doc.total_sessions || 0);
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to summarize guild ${guildId}: ${error}`);
        return null;
    }
};
RadioDB.getUserSummary = async (userId) => {
    try {
        const doc = await radio_user_1.default.findOne({ userId }).lean();
        if (!doc?.stations?.length)
            return null;
        return _a.summarize(doc.stations, doc.total_listen_ms || 0, doc.total_sessions || 0);
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to summarize user ${userId}: ${error}`);
        return null;
    }
};
RadioDB.getGlobalSummary = async () => {
    try {
        const [row] = await radio_guild_1.default.aggregate([
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
        if (!row)
            return null;
        const genres = new Map();
        for (const entry of row.genres || []) {
            if (!entry?.genre)
                continue;
            genres.set(entry.genre, (genres.get(entry.genre) ?? 0) + (entry.plays || 0));
        }
        return { uniqueStations: row.uniqueStations, totalPlays: row.totalPlays, totalListenMs: row.totalListenMs, totalSessions: row.totalSessions, topGenre: [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, countries: row.countries };
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to compute global summary: ${error}`);
        return null;
    }
};
RadioDB.getGuildTopStations = async (guildId, limit = 10) => {
    try {
        const doc = await radio_guild_1.default.findOne({ guildId }).lean();
        return doc?.stations?.length ? _a.toTop(doc.stations, limit) : [];
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to read top stations for guild ${guildId}: ${error}`);
        return [];
    }
};
RadioDB.getUserTopStations = async (userId, limit = 10) => {
    try {
        const doc = await radio_user_1.default.findOne({ userId }).lean();
        return doc?.stations?.length ? _a.toTop(doc.stations, limit) : [];
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to read top stations for user ${userId}: ${error}`);
        return [];
    }
};
RadioDB.getGlobalTopStations = async (limit = 10) => {
    try {
        const rows = await radio_guild_1.default.aggregate([
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
    }
    catch (error) {
        pepper_1.default.logger?.warn(`[RADIO_DB] Failed to read global top stations: ${error}`);
        return [];
    }
};
