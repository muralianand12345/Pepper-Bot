import discord from 'discord.js';

import { Command } from '../types';
import { Music } from '../core/music';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const stopCommand: Command = {
	cooldown: 1,
	category: ['music'],
	data: new discord.SlashCommandBuilder().setName('stop').setDescription('Stop the music and disconnect from voice channel').setNameLocalizations(localizationManager.getCommandLocalizations('commands.stop.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.stop.description')),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.stop();
	},
};

export default stopCommand;
