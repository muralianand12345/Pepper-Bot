"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateStatsCache = exports.getGlobalGuildCount = exports.getGlobalStats = exports.getShardId = exports.isPrimaryShard = void 0;
const STATS_TTL = 5 * 60 * 1000;
let cachedStats = null;
let cachedAt = 0;
let inFlight = null;
const isPrimaryShard = (client) => {
    if (!client.shard)
        return true;
    return client.shard.ids.includes(0);
};
exports.isPrimaryShard = isPrimaryShard;
const getShardId = (client) => client.shard?.ids[0] ?? 0;
exports.getShardId = getShardId;
const localStats = (client) => ({
    guilds: client.guilds.cache.size,
    members: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
    channels: client.channels.cache.size,
    players: client.manager?.players.size ?? 0,
    shards: 1,
});
const fetchGlobalStats = async (client) => {
    if (!client.shard)
        return localStats(client);
    try {
        const results = (await client.shard.broadcastEval((c) => ({
            guilds: c.guilds.cache.size,
            members: c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
            channels: c.channels.cache.size,
            players: c.manager?.players.size ?? 0,
        })));
        if (!results.length)
            return localStats(client);
        return {
            guilds: results.reduce((acc, r) => acc + r.guilds, 0),
            members: results.reduce((acc, r) => acc + r.members, 0),
            channels: results.reduce((acc, r) => acc + r.channels, 0),
            players: results.reduce((acc, r) => acc + r.players, 0),
            shards: results.length,
        };
    }
    catch (error) {
        client.logger?.warn(`[SHARD] Failed to aggregate global stats: ${error}`);
        return cachedStats ?? localStats(client);
    }
};
const getGlobalStats = async (client, force = false) => {
    if (!force && cachedStats && Date.now() - cachedAt < STATS_TTL)
        return cachedStats;
    if (inFlight)
        return inFlight;
    inFlight = fetchGlobalStats(client)
        .then((stats) => {
        cachedStats = stats;
        cachedAt = Date.now();
        return stats;
    })
        .finally(() => {
        inFlight = null;
    });
    return inFlight;
};
exports.getGlobalStats = getGlobalStats;
const getGlobalGuildCount = async (client) => {
    if (!client.shard)
        return client.guilds.cache.size;
    try {
        const counts = (await client.shard.fetchClientValues("guilds.cache.size"));
        const total = counts.reduce((acc, count) => acc + (count ?? 0), 0);
        return total || client.guilds.cache.size;
    }
    catch (error) {
        client.logger?.warn(`[SHARD] Failed to fetch global guild count: ${error}`);
        return client.guilds.cache.size;
    }
};
exports.getGlobalGuildCount = getGlobalGuildCount;
const invalidateStatsCache = () => {
    cachedStats = null;
    cachedAt = 0;
};
exports.invalidateStatsCache = invalidateStatsCache;
