import path from 'path';
import discord from 'discord.js';
import { promises as fs } from 'fs';
import magmastream from 'magmastream';

import { BotEvent } from '../../../types';

const loadLavalinkEvents = async (client: discord.Client, eventsPath: string): Promise<void> => {
	try {
		const eventFiles = (await fs.readdir(eventsPath)).filter((file) => file.endsWith('.js') || file.endsWith('.ts'));
		for (const file of eventFiles) {
			try {
				const filePath = path.join(eventsPath, file);
				const event: BotEvent = require(filePath).default;
				if (!event?.name || typeof event?.execute !== 'function') {
					client.logger.warn(`[LAVALINK_EVENT] Invalid event file structure: ${file}`);
					continue;
				}

				client.manager.on(event.name as keyof magmastream.ManagerEvents, (...args) => event.execute(...args, client));
				client.logger.debug(`[LAVALINK_EVENT] Loaded event: ${event.name}`);
			} catch (error) {
				client.logger.error(`[LAVALINK_EVENT] Failed to load event ${file}: ${error instanceof Error ? error.message : String(error)}`);
				throw error;
			}
		}
	} catch (error) {
		client.logger.error(`[LAVALINK_EVENT] Failed to read events directory: ${error instanceof Error ? error.message : String(error)}`);
		throw error;
	}
};

const event: BotEvent = {
	name: discord.Events.ClientReady,
	execute: async (client: discord.Client): Promise<void> => {
		try {
			if (!client.user) throw new Error('[LAVALINK] Client user is not defined');
			if (!client.config.music.enabled) return client.logger.info('[LAVALINK] Music functionality is disabled');
			client.manager.init(client.user.id);
			await loadLavalinkEvents(client, path.join(__dirname, 'lavalink_events'));
			client.logger.info('[LAVALINK] Successfully initialized and loaded all events');
		} catch (error) {
			client.logger.error(`[LAVALINK] Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	},
};

export default event;
