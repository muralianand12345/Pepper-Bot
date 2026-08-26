import crypto from 'crypto';
import express from 'express';
import discord from 'discord.js';

import { MusicDB, StatsDB } from '../../../music/repo';
import { ConfigManager } from '../../../../utils/config';
import { ISongs, StatsGuildMeta, StatsRealtime, StatsRealtimeTrack, StatsServerInsight, StatsTopRequester } from '../../../../types';

const configManager = ConfigManager.getInstance();

const SNOWFLAKE = /^\d{17,20}$/;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export default class StatsAPIHandler {
	private client: discord.Client;
	private router: express.Router;
	private apiKey: string;

	constructor(client: discord.Client, apiKey: string) {
		this.client = client;
		this.router = express.Router();
		this.apiKey = apiKey;
		this.router.use(this.authenticate);
		this.setupRoutes();
	}

	private setupRoutes = (): void => {
		this.router.get('/realtime', this.handleRealtime);
		this.router.get('/overview', this.handleOverview);
		this.router.get('/songs', this.handleSongs);
		this.router.get('/requesters', this.handleRequesters);
		this.router.get('/playtime', this.handlePlaytime);
		this.router.get('/servers', this.handleServers);
		this.router.get('/servers/:guildId', this.handleServer);
		this.router.use((_req: express.Request, res: express.Response) => res.status(404).json({ success: false, error: 'Unknown stats endpoint' }));
	};

	private authenticate = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
		const provided = (req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '') || '').trim();
		const expected = Buffer.from(this.apiKey);
		const supplied = Buffer.from(provided);
		if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
			res.status(401).json({ success: false, error: 'Invalid or missing API key' });
			return;
		}
		next();
	};

	private parseLimit = (value: unknown, fallback: number = DEFAULT_LIMIT): number => {
		const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
		if (!Number.isFinite(parsed) || parsed < 1) return fallback;
		return Math.min(parsed, MAX_LIMIT);
	};

	private send = (res: express.Response, data: unknown, cached: boolean = false): void => {
		res.status(200).json({ success: true, cached, generatedAt: new Date().toISOString(), data });
	};

	private fail = (res: express.Response, error: unknown, context: string): void => {
		this.client.logger.error(`[STATS_API] ${context}: ${error}`);
		res.status(503).json({ success: false, error: 'Failed to compute statistics' });
	};

	private fetchGuildMeta = async (guildIds: string[]): Promise<Map<string, StatsGuildMeta>> => {
		const meta = new Map<string, StatsGuildMeta>();
		if (!guildIds.length) return meta;

		const readLocal = (c: discord.Client, ids: string[]) =>
			ids.reduce<Record<string, { name: string; icon: string | null; memberCount: number }>>((acc, id) => {
				const guild = c.guilds.cache.get(id);
				if (guild) acc[id] = { name: guild.name, icon: guild.iconURL() ?? null, memberCount: guild.memberCount };
				return acc;
			}, {});

		try {
			if (!this.client.shard) {
				for (const [id, value] of Object.entries(readLocal(this.client, guildIds))) meta.set(id, value);
				return meta;
			}

			const results = (await this.client.shard.broadcastEval(readLocal, { context: guildIds })) as Record<string, StatsGuildMeta>[];
			for (const shardResult of results) {
				for (const [id, value] of Object.entries(shardResult || {})) meta.set(id, value);
			}
		} catch (error) {
			this.client.logger.warn(`[STATS_API] Failed to resolve guild metadata: ${error}`);
		}
		return meta;
	};

	private collectRealtime = async (): Promise<StatsRealtime> => {
		const readShard = async (c: discord.Client) => {
			const players = [...(c.manager?.players?.values() ?? [])];
			const nowPlaying = await Promise.all(
				players.map(async (player) => {
					const track = await Promise.resolve(player.queue.getCurrent()).catch(() => null);
					const queueSize = await Promise.resolve(player.queue.size()).catch(() => 0);
					const voiceChannel = player.voiceChannelId ? c.channels.cache.get(player.voiceChannelId) : null;
					const listeners = voiceChannel && voiceChannel.isVoiceBased() ? voiceChannel.members.filter((member) => !member.user.bot).size : 0;
					const requester = track?.requester as { id?: string; username?: string; discriminator?: string; avatar?: string } | undefined;
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
				}),
			);

			return { guilds: c.guilds.cache.size, members: c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0), channels: c.channels.cache.size, nowPlaying };
		};

		type ShardSnapshot = Awaited<ReturnType<typeof readShard>>;
		const snapshots: ShardSnapshot[] = this.client.shard ? ((await this.client.shard.broadcastEval(readShard)) as ShardSnapshot[]) : [await readShard(this.client)];

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
			nowPlaying: active.map(({ hasTrack, ...track }) => track as StatsRealtimeTrack).sort((a, b) => b.listeners - a.listeners),
		};
	};

	private liveGuildIds = async (): Promise<Set<string>> => {
		try {
			const readIds = (c: discord.Client) => [...(c.manager?.players?.keys() ?? [])];
			const results = this.client.shard ? ((await this.client.shard.broadcastEval(readIds)) as string[][]) : [readIds(this.client)];
			return new Set(results.flat());
		} catch (error) {
			this.client.logger.warn(`[STATS_API] Failed to resolve live guilds: ${error}`);
			return new Set<string>();
		}
	};

	private enrichServers = async (servers: StatsServerInsight[]): Promise<StatsServerInsight[]> => {
		const [meta, live] = await Promise.all([this.fetchGuildMeta(servers.map((server) => server.guildId)), this.liveGuildIds()]);
		return servers.map((server) => {
			const guild = meta.get(server.guildId);
			return { ...server, guildName: guild?.name ?? null, guildIcon: guild?.icon ?? null, memberCount: guild?.memberCount ?? null, live: live.has(server.guildId) };
		});
	};

	private handleRealtime = async (_req: express.Request, res: express.Response): Promise<void> => {
		try {
			this.send(res, await this.collectRealtime());
		} catch (error) {
			this.fail(res, error, 'realtime');
		}
	};

	private handleOverview = async (_req: express.Request, res: express.Response): Promise<void> => {
		try {
			const cached = StatsDB.isCached('overview');
			this.send(res, await StatsDB.getOverview(), cached);
		} catch (error) {
			this.fail(res, error, 'overview');
		}
	};

	private handleSongs = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
			const [totals, topSongs] = await Promise.all([StatsDB.getSongTotals(), MusicDB.getGlobalTopSongs(limit)]);
			const songs = (topSongs as (ISongs & { _id?: string })[]).map(({ _id, ...song }) => song);
			this.send(res, { ...totals, limit, topSongs: songs });
		} catch (error) {
			this.fail(res, error, 'songs');
		}
	};

	private handleRequesters = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
			const poolSize = Math.min(limit * 2, MAX_LIMIT);
			const cached = StatsDB.isCached(`requesters:${poolSize}`);
			const requesters = await StatsDB.getTopRequesters(poolSize);
			const resolved = await Promise.all(
				requesters.map(async (requester) => {
					const user = await this.client.users.fetch(requester.userId).catch(() => null);
					if (!user) return requester;
					if (user.bot) return null;
					return { ...requester, username: user.username, avatar: user.displayAvatarURL() };
				}),
			);
			const people = resolved.filter((requester): requester is StatsTopRequester => requester !== null).slice(0, limit).map((requester, index) => ({ ...requester, rank: index + 1 }));
			this.send(res, { limit, requesters: people }, cached);
		} catch (error) {
			this.fail(res, error, 'requesters');
		}
	};

	private handlePlaytime = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
			const cached = StatsDB.isCached(`playtime:${limit}`);
			const playtime = await StatsDB.getPlaytime(limit);
			const meta = await this.fetchGuildMeta(playtime.servers.map((server) => server.guildId));
			this.send(res, { ...playtime, limit, servers: playtime.servers.map((server) => ({ ...server, guildName: meta.get(server.guildId)?.name ?? null })) }, cached);
		} catch (error) {
			this.fail(res, error, 'playtime');
		}
	};

	private handleServers = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			const limit = this.parseLimit(req.query.limit, DEFAULT_LIMIT);
			const cached = StatsDB.isCached(`servers:${limit}`);
			const servers = await StatsDB.getServerInsights(limit);
			this.send(res, { limit, servers: await this.enrichServers(servers) }, cached);
		} catch (error) {
			this.fail(res, error, 'servers');
		}
	};

	private handleServer = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			const guildId = String(req.params.guildId);
			if (!SNOWFLAKE.test(guildId)) {
				res.status(400).json({ success: false, error: 'Invalid guild id' });
				return;
			}
			const cached = StatsDB.isCached(`server:${guildId}`);
			const server = await StatsDB.getServerInsight(guildId);
			if (!server) {
				res.status(404).json({ success: false, error: 'No music data found for this guild' });
				return;
			}
			const [enriched] = await this.enrichServers([server]);
			this.send(res, enriched, cached);
		} catch (error) {
			this.fail(res, error, 'server');
		}
	};

	getRouter = (): express.Router => {
		return this.router;
	};
}

export const getStatsApiKey = (): string | undefined => configManager.getStatsApiKey();
