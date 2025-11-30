import express from 'express';
import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { version } from '../../../../package.json';
import { ConfigManager } from '../../../utils/config';
import SpotifyAPIHandler from '../../../core/api/music/accounts/spotify';

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
		this.app.get('/', (req, res) => res.json({ message: 'Pepper API', version }));
	};

	start = (): void => {
		this.app.listen(this.port, () => this.client.logger.log(`API Server running on port ${this.port}`));
	};
}

const event: BotEvent = {
	name: discord.Events.ClientReady,
	execute: async (client: discord.Client): Promise<void> => {
		const apiServer = new APIServer(client);
		apiServer.start();
	},
};

export default event;
