import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { LavaLink } from '../../../core/music';

const event: BotEvent = {
	name: discord.Events.ClientReady,
	execute: async (client: discord.Client): Promise<void> => {
		try {
			if (!client.config.music.enabled) return client.logger.info('[LAVALINK] Music is disabled, skipping user node initialization');
			client.logger.info('[LAVALINK] Initializing user Lavalink nodes...');
			const lavalink = new LavaLink(client);
			await lavalink.initializeUserNodes();
		} catch (error) {
			client.logger.error(`[LAVALINK] Failed to initialize user nodes: ${error}`);
		}
	},
};

export default event;
