import express from 'express';
import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { version } from '../../../../package.json';
import { isPrimaryShard } from '../../../utils/shard';
import { ConfigManager } from '../../../utils/config';
import SpotifyAPIHandler from '../../../core/api/music/accounts/spotify';
import StatsAPIHandler from '../../../core/api/music/stats';

const configManager = ConfigManager.getInstance();

class APIServer {
	private client: discord.Client;
	private app: express.Application;
	private port: number;

	constructor(client: discord.Client) {
		this.client = client;
		this.app = express();
		this.port = configManager.getApiPort() || 3000;
		this.setupMiddleware();
		this.setupRoutes();
	}

	private setupMiddleware = (): void => {
		this.app.use(express.json());
		this.app.use(express.urlencoded({ extended: true }));
	};

	private setupRoutes = (): void => {
		const spotifyHandler = new SpotifyAPIHandler(this.client);
		this.app.use('/api/v1/accounts/spotify', spotifyHandler.getRouter());

		const statsApiKey = configManager.getStatsApiKey();
		if (statsApiKey) {
			const statsHandler = new StatsAPIHandler(this.client, statsApiKey);
			this.app.use('/api/v1/stats', statsHandler.getRouter());
		} else {
			this.client.logger.warn('[API] STATS_API_KEY not set, music stats routes not mounted');
		}

		this.app.get('/', (req, res) => res.json({ message: 'Pepper API', version }));
	};

	start = (): void => {
		const server = this.app.listen(this.port, () => this.client.logger.log(`API Server running on port ${this.port}`));
		server.on('error', (error: NodeJS.ErrnoException) => {
			if (error.code === 'EADDRINUSE') return this.client.logger.error(`[API] Port ${this.port} already in use, API server not started`);
			this.client.logger.error(`[API] Server error: ${error}`);
		});
	};
}

const event: BotEvent = {
	name: discord.Events.ClientReady,
	execute: async (client: discord.Client): Promise<void> => {
		if (!isPrimaryShard(client)) return client.logger.debug(`[API] Skipping API server on shard ${client.shard?.ids[0]} (primary shard only)`);
		const apiServer = new APIServer(client);
		apiServer.start();
	},
};

export default event;
