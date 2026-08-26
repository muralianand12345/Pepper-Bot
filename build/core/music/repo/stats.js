"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsDB = void 0;
const pepper_1 = __importDefault(require("../../../pepper"));
const music_user_1 = __importDefault(require("../../../events/database/schema/music_user"));
const music_guild_1 = __importDefault(require("../../../events/database/schema/music_guild"));
const CACHE_TTL = 60 * 1000;
class StatsDB {
}
exports.StatsDB = StatsDB;
_a = StatsDB;
StatsDB.cache = new Map();
StatsDB.inFlight = new Map();
StatsDB.withCache = async (key, producer) => {
    const cached = _a.cache.get(key);
    if (cached && cached.expiresAt > Date.now())
        return cached.value;
    const pending = _a.inFlight.get(key);
    if (pending)
        return pending;
    const promise = producer()
        .then((value) => {
        _a.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
        return value;
    })
        .finally(() => {
        _a.inFlight.delete(key);
    });
    _a.inFlight.set(key, promise);
    return promise;
};
StatsDB.excludedUserIds = () => (pepper_1.default.user?.id ? [pepper_1.default.user.id] : []);
StatsDB.isCached = (key) => {
    const cached = _a.cache.get(key);
    return !!cached && cached.expiresAt > Date.now();
};
StatsDB.invalidate = (key) => {
    if (key)
        _a.cache.delete(key);
    else
        _a.cache.clear();
};
StatsDB.getOverview = async () => {
    return _a.withCache('overview', async () => {
        const empty = { uniqueSongs: 0, totalPlays: 0, uniqueArtists: 0, estimatedPlaytimeMs: 0, activeGuilds: 0, trackedListeners: 0, songsLastPlayed24h: 0, songsLastPlayed7d: 0, lastPlayedAt: null };
        try {
            const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const [aggregate, activeGuilds, trackedListeners] = await Promise.all([
                music_guild_1.default
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
                music_guild_1.default.countDocuments({ 'songs.0': { $exists: true } }),
                music_user_1.default.countDocuments({ 'songs.0': { $exists: true }, userId: { $nin: _a.excludedUserIds() } }),
            ]);
            if (!aggregate || aggregate.length === 0)
                return { ...empty, activeGuilds, trackedListeners };
            return { ...empty, ...aggregate[0], activeGuilds, trackedListeners };
        }
        catch (err) {
            pepper_1.default.logger.error(`[STATS] Error in getOverview: ${err}`);
            return empty;
        }
    });
};
StatsDB.getTopRequesters = async (limit = 10) => {
    return _a.withCache(`requesters:${limit}`, async () => {
        try {
            const result = await music_user_1.default
                .aggregate([
                { $match: { userId: { $nin: _a.excludedUserIds() } } },
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
        }
        catch (err) {
            pepper_1.default.logger.error(`[STATS] Error in getTopRequesters: ${err}`);
            return [];
        }
    });
};
StatsDB.getPlaytime = async (limit = 10) => {
    return _a.withCache(`playtime:${limit}`, async () => {
        const empty = { estimatedPlaytimeMs: 0, totalPlays: 0, trackedGuilds: 0, servers: [] };
        try {
            const result = await music_guild_1.default
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
            if (!result || result.length === 0)
                return empty;
            const totals = result[0].totals?.[0];
            return { estimatedPlaytimeMs: totals?.estimatedPlaytimeMs ?? 0, totalPlays: totals?.totalPlays ?? 0, trackedGuilds: totals?.trackedGuilds ?? 0, servers: (result[0].servers || []).map((server) => ({ ...server, guildName: null })) };
        }
        catch (err) {
            pepper_1.default.logger.error(`[STATS] Error in getPlaytime: ${err}`);
            return empty;
        }
    });
};
StatsDB.serverInsightStages = (limit) => [
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
StatsDB.toServerInsight = (raw) => ({
    guildId: String(raw.guildId),
    guildName: null,
    guildIcon: null,
    memberCount: null,
    totalPlays: Number(raw.totalPlays ?? 0),
    uniqueSongs: Number(raw.uniqueSongs ?? 0),
    uniqueArtists: Number(raw.uniqueArtists ?? 0),
    estimatedPlaytimeMs: Number(raw.estimatedPlaytimeMs ?? 0),
    averagePlaysPerSong: Number(raw.averagePlaysPerSong ?? 0),
    sources: raw.sources ?? [],
    topSong: raw.topSong ?? null,
    lastPlayedAt: raw.lastPlayedAt ?? null,
    live: false,
});
StatsDB.getServerInsights = async (limit = 10) => {
    return _a.withCache(`servers:${limit}`, async () => {
        try {
            const result = await music_guild_1.default.aggregate(_a.serverInsightStages(limit)).allowDiskUse(true);
            return (result || []).map(_a.toServerInsight);
        }
        catch (err) {
            pepper_1.default.logger.error(`[STATS] Error in getServerInsights: ${err}`);
            return [];
        }
    });
};
StatsDB.getServerInsight = async (guildId) => {
    return _a.withCache(`server:${guildId}`, async () => {
        try {
            const result = await music_guild_1.default.aggregate([{ $match: { guildId } }, ..._a.serverInsightStages()]).allowDiskUse(true);
            if (!result || result.length === 0)
                return null;
            return _a.toServerInsight(result[0]);
        }
        catch (err) {
            pepper_1.default.logger.error(`[STATS] Error in getServerInsight: ${err}`);
            return null;
        }
    });
};
StatsDB.getSongTotals = async () => {
    const overview = await _a.getOverview();
    return { uniqueSongs: overview.uniqueSongs, totalPlays: overview.totalPlays };
};
