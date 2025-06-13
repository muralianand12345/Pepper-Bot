import path from 'path';
import discord from 'discord.js';

import { BotEvent } from '../types';
import { CommandManager } from '../core/commands';

const event: BotEvent = {
	name: discord.Events.ClientReady,
	execute: async (client: discord.Client): Promise<void> => {
		try {
			const slashCommandsDir = path.join(__dirname, '../commands');
			const commandManager = new CommandManager(client);
			await commandManager.load(slashCommandsDir);
		} catch (error) {
			client.logger.error(`[COMMAND] Failed to load commands: ${error}`);
		}
	},
};

export default event;
