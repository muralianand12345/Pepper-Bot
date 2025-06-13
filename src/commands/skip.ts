import discord from 'discord.js';

import { Command } from '../types';
import { Music } from '../core/music';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const skipCommand: Command = {
	cooldown: 2,
	data: new discord.SlashCommandBuilder()
		.setName('skip')
		.setDescription('Skip the current song and play the next one')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.skip.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.skip.description')),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.skip();
	},
};

export default skipCommand;
