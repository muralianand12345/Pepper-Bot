import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { CommandInteractionHandler } from '../../../core/commands';

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		const handler = new CommandInteractionHandler(client, interaction);
		await handler.handle();
	},
};

export default event;
