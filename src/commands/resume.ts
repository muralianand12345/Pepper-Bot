import discord from 'discord.js';

import { Music } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const resumeCommand: Command = {
	cooldown: 1,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder().setName('resume').setDescription('Resume the paused music').setNameLocalizations(localizationManager.getCommandLocalizations('commands.resume.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.resume.description')),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.resume();
	},
};

export default resumeCommand;
