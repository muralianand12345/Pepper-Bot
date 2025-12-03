import discord from 'discord.js';

import { Music } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const volumeCommand: Command = {
	cooldown: 120,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('volume')
		.setDescription('Set the volume for the music player')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.volume.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.volume.description'))
		.addIntegerOption((option) => option.setName('volume').setDescription('Volume level (0-100)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.volume.options.volume.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.volume.options.volume.description')).setRequired(true)),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		const volume = interaction.options.getInteger('volume', true);
		await music.volume(volume);
	},
};

export default volumeCommand;
