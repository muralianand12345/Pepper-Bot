"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatsApiKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const repo_1 = require("../../../music/repo");
const config_1 = require("../../../../utils/config");
const configManager = config_1.ConfigManager.getInstance();
const SNOWFLAKE = /^\d{17,20}$/;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
class StatsAPIHandler {
    constructor(client, apiKey) {
        this.setupRoutes = () => {
            this.router.get('/realtime', this.handleRealtime);
            this.router.get('/overview', this.handleOverview);
            this.router.get('/songs', this.handleSongs);
            this.router.get('/requesters', this.handleRequesters);
            this.router.get('/playtime', this.handlePlaytime);
            this.router.get('/servers', this.handleServers);
            this.router.get('/servers/:guildId', this.handleServer);
            this.router.use((_req, res) => res.status(404).json({ success: false, error: 'Unknown stats endpoint' }));
        };
        this.authenticate = (req, res, next) => {
            const provided = (req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '') || '').trim();
            const expected = Buffer.from(this.apiKey);
            const supplied = Buffer.from(provided);
            if (supplied.length !== expected.length || !crypto_1.default.timingSafeEqual(supplied, expected)) {
                res.status(401).json({ success: false, error: 'Invalid or missing API key' });
                return;
            }
            next();
        };
        this.parseLimit = (value, fallback = DEFAULT_LIMIT) => {
            const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
            if (!Number.isFinite(parsed) || parsed < 1)
                return fallback;
            return Math.min(parsed, MAX_LIMIT);
        };
        this.send = (res, data, cached = false) => {
            res.status(200).json({ success: true, cached, generatedAt: new Date().toISOString(), data });
        };
        this.fail = (res, error, context) => {
            this.client.logger.error(`[STATS_API] ${context}: ${error}`);
            res.status(503).json({ success: false, error: 'Failed to compute statistics' });
        };
        this.fetchGuildMeta = async (guildIds) => {
            const meta = new Map();
            if (!guildIds.length)
                return meta;
            const readLocal = (c, ids) => ids.reduce((acc, id) => {
                const guild = c.guilds.cache.get(id);
                if (guild)
                    acc[id] = { name: guild.name, icon: guild.iconURL() ?? null, memberCount: guild.memberCount };
                return acc;
            }, {});
            try {
                if (!this.client.shard) {
                    for (const [id, value] of Object.entries(readLocal(this.client, guildIds)))
                        meta.set(id, value);
                    return meta;
                }
                const results = (await this.client.shard.broadcastEval(readLocal, { context: guildIds }));
                for (const shardResult of results) {
                    for (const [id, value] of Object.entries(shardResult || {}))
                        meta.set(id, value);
                }
            }
            catch (error) {
                this.client.logger.warn(`[STATS_API] Failed to resolve guild metadata: ${error}`);
            }
            return meta;
        };
        this.collectRealtime = async () => {
            const readShard = async (c) => {
                const players = [...(c.manager?.players?.values() ?? [])];
                const nowPlaying = await Promise.all(players.map(async (player) => {
                    const track = await Promise.resolve(player.queue.getCurrent()).catch(() => null);
                    const queueSize = await Promise.resolve(player.queue.size()).catch(() => 0);
                    const voiceChannel = player.voiceChannelId ? c.channels.cache.get(player.voiceChannelId) : null;
                    const listeners = voiceChannel && voiceChannel.isVoiceBased() ? voiceChannel.members.filter((member) => !member.user.bot).size : 0;
                    const requester = track?.requester;
                    return {
                        guildId: player.guildId,
                        guildName: c.guilds.cache.get(player.guildId)?.name ?? null,
                        voiceChannelId: player.voiceChannelId ?? null,
                        listeners,
                        playing: !!player.playing,
                        paused: !!player.paused,
                        position: Number.isFinite(player.position) ? Number(player.position) : 0,
                        queueSize,
                        title: track?.title ?? 'Unknown',
                        author: track?.author ?? 'Unknown',
                        uri: track?.uri ?? '',
                        duration: track?.duration ?? 0,
                        artworkUrl: track?.artworkUrl ?? track?.thumbnail ?? null,
                        sourceName: String(track?.sourceName ?? 'unknown'),
                        requester: requester?.id ? { id: requester.id, username: requester.username ?? 'Unknown', discriminator: requester.discriminator ?? '0', avatar: requester.avatar } : null,
                        shardId: c.shard?.ids[0] ?? 0,
                        hasTrack: !!track,
                    };
                }));
                return { guilds: c.guilds.cache.size, members: c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0), channels: c.channels.cache.size, nowPlaying };
            };
            const snapshots = this.client.shard ? (await this.client.shard.broadcastEval(readShard)) : [await readShard(this.client)];
            const tracks = snapshots.flatMap((snapshot) => snapshot.nowPlaying ?? []);
            const active = tracks.filter((track) => track.hasTrack);
            return {
                players: tracks.length,
                playing: tracks.filter((track) => track.playing && !track.paused).length,
                paused: tracks.filter((track) => track.paused).length,
                idle: tracks.length - active.length,
                listeners: tracks.reduce((acc, track) => acc + track.listeners, 0),
                guilds: snapshots.reduce((acc, snapshot) => acc + snapshot.guilds, 0),
                members: snapshots.reduce((acc, snapshot) => acc + snapshot.members, 0),
                channels: snapshots.reduce((acc, snapshot) => acc + snapshot.channels, 0),
                shards: snapshots.length,
                uptime: this.client.uptime ?? 0,
                nowPlaying: active.map(({ hasTrack, ...track }) => track).sort((a, b) => b.listeners - a.listeners),
            };
        };
        this.liveGuildIds = async () => {
            try {
                const readIds = (c) => [...(c.manager?.players?.keys() ?? [])];
                const results = this.client.shard ? (await this.client.shard.broadcastEval(readIds)) : [readIds(this.client)];
                return new Set(results.flat());
            }
            catch (error) {
                this.client.logger.warn(`[STATS_API] Failed to resolve live guilds: ${error}`);
                return new Set();
            }
        };
        this.enrichServers = async (servers) => {
            const [meta, live] = await Promise.all([this.fetchGuildMeta(servers.map((server) => server.guildId)), this.liveGuildIds()]);
            return servers.map((server) => {
                const guild = meta.get(server.guildId);
                return { ...server, guildName: guild?.name ?? null, guildIcon: guild?.icon ?? null, memberCount: guild?.memberCount ?? null, live: live.has(server.guildId) };
            });
        };
        this.handleRealtime = async (_req, res) => {
            try {
                this.send(res, await this.collectRealtime());
            }
            catch (error) {
                this.fail(res, error, 'realtime');
            }
        };
        this.handleOverview = async (_req, res) => {
            try {
                const cached = repo_1.StatsDB.isCached('overview');
                this.send(res, await repo_1.StatsDB.getOverview(), cached);
            }
            catch (error) {
                this.fail(res, error, 'overview');
            }
        };
        this.handleSongs = async (req, res) => {
            try {
                const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
                const [totals, topSongs] = await Promise.all([repo_1.StatsDB.getSongTotals(), repo_1.MusicDB.getGlobalTopSongs(limit)]);
                const songs = topSongs.map(({ _id, ...song }) => song);
                this.send(res, { ...totals, limit, topSongs: songs });
            }
            catch (error) {
                this.fail(res, error, 'songs');
            }
        };
        this.handleRequesters = async (req, res) => {
            try {
                const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
                const poolSize = Math.min(limit * 2, MAX_LIMIT);
                const cached = repo_1.StatsDB.isCached(`requesters:${poolSize}`);
                const requesters = await repo_1.StatsDB.getTopRequesters(poolSize);
                const resolved = await Promise.all(requesters.map(async (requester) => {
                    const user = await this.client.users.fetch(requester.userId).catch(() => null);
                    if (!user)
                        return requester;
                    if (user.bot)
                        return null;
                    return { ...requester, username: user.username, avatar: user.displayAvatarURL() };
                }));
                const people = resolved.filter((requester) => requester !== null).slice(0, limit).map((requester, index) => ({ ...requester, rank: index + 1 }));
                this.send(res, { limit, requesters: people }, cached);
            }
            catch (error) {
                this.fail(res, error, 'requesters');
            }
        };
        this.handlePlaytime = async (req, res) => {
            try {
                const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
                const cached = repo_1.StatsDB.isCached(`playtime:${limit}`);
                const playtime = await repo_1.StatsDB.getPlaytime(limit);
                const meta = await this.fetchGuildMeta(playtime.servers.map((server) => server.guildId));
                this.send(res, { ...playtime, limit, servers: playtime.servers.map((server) => ({ ...server, guildName: meta.get(server.guildId)?.name ?? null })) }, cached);
            }
            catch (error) {
                this.fail(res, error, 'playtime');
            }
        };
        this.handleServers = async (req, res) => {
            try {
                const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
                const cached = repo_1.StatsDB.isCached(`servers:${limit}`);
                const servers = await repo_1.StatsDB.getServerInsights(limit);
                this.send(res, { limit, servers: await this.enrichServers(servers) }, cached);
            }
            catch (error) {
                this.fail(res, error, 'servers');
            }
        };
        this.handleServer = async (req, res) => {
            try {
                const guildId = String(req.params.guildId);
                if (!SNOWFLAKE.test(guildId)) {
                    res.status(400).json({ success: false, error: 'Invalid guild id' });
                    return;
                }
                const cached = repo_1.StatsDB.isCached(`server:${guildId}`);
                const server = await repo_1.StatsDB.getServerInsight(guildId);
                if (!server) {
                    res.status(404).json({ success: false, error: 'No music data found for this guild' });
                    return;
                }
                const [enriched] = await this.enrichServers([server]);
                this.send(res, enriched, cached);
            }
            catch (error) {
                this.fail(res, error, 'server');
            }
        };
        this.getRouter = () => {
            return this.router;
        };
        this.client = client;
        this.router = express_1.default.Router();
        this.apiKey = apiKey;
        this.router.use(this.authenticate);
        this.setupRoutes();
    }
}
exports.default = StatsAPIHandler;
const getStatsApiKey = () => configManager.getStatsApiKey();
exports.getStatsApiKey = getStatsApiKey;
