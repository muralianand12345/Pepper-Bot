import discord from "discord.js";

export type GlobalStats = { guilds: number; members: number; channels: number; players: number; shards: number };

const STATS_TTL = 5 * 60 * 1000;

let cachedStats: GlobalStats | null = null;
let cachedAt = 0;
let inFlight: Promise<GlobalStats> | null = null;

export const isPrimaryShard = (client: discord.Client): boolean => {
    if (!client.shard) return true;
    return client.shard.ids.includes(0);
};

export const getShardId = (client: discord.Client): number => client.shard?.ids[0] ?? 0;

const localStats = (client: discord.Client): GlobalStats => ({
    guilds: client.guilds.cache.size,
    members: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
    channels: client.channels.cache.size,
    players: client.manager?.players.size ?? 0,
    shards: 1,
});

const fetchGlobalStats = async (client: discord.Client): Promise<GlobalStats> => {
    if (!client.shard) return localStats(client);

    try {
        const results = (await client.shard.broadcastEval((c) => ({
            guilds: c.guilds.cache.size,
            members: c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
            channels: c.channels.cache.size,
            players: c.manager?.players.size ?? 0,
        }))) as Omit<GlobalStats, "shards">[];

        if (!results.length) return localStats(client);

        return {
            guilds: results.reduce((acc, r) => acc + r.guilds, 0),
            members: results.reduce((acc, r) => acc + r.members, 0),
            channels: results.reduce((acc, r) => acc + r.channels, 0),
            players: results.reduce((acc, r) => acc + r.players, 0),
            shards: results.length,
        };
    } catch (error) {
        client.logger?.warn(`[SHARD] Failed to aggregate global stats: ${error}`);
        return cachedStats ?? localStats(client);
    }
};

export const getGlobalStats = async (client: discord.Client, force: boolean = false): Promise<GlobalStats> => {
    if (!force && cachedStats && Date.now() - cachedAt < STATS_TTL) return cachedStats;
    if (inFlight) return inFlight;

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

export const getGlobalGuildCount = async (client: discord.Client): Promise<number> => {
    if (!client.shard) return client.guilds.cache.size;

    try {
        const counts = (await client.shard.fetchClientValues("guilds.cache.size")) as (number | undefined)[];
        const total = counts.reduce<number>((acc, count) => acc + (count ?? 0), 0);
        return total || client.guilds.cache.size;
    } catch (error) {
        client.logger?.warn(`[SHARD] Failed to fetch global guild count: ${error}`);
        return client.guilds.cache.size;
    }
};

export const invalidateStatsCache = (): void => {
    cachedStats = null;
    cachedAt = 0;
};
