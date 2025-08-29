import discord from 'discord.js';

import { Music } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const pauseCommand: Command = {
	cooldown: 1,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder().setName('pause').setDescription('Pause the currently playing music').setNameLocalizations(localizationManager.getCommandLocalizations('commands.pause.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.pause.description')),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.pause();
	},
};

export default pauseCommand;
