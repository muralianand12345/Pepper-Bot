import discord from 'discord.js';

import { Command } from '../types';
import { Music } from '../core/music';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const lyricsCommand: Command = {
	cooldown: 5,
	data: new discord.SlashCommandBuilder()
		.setName('lyrics')
		.setDescription('Display lyrics for the currently playing track')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addBooleanOption((option) => option.setName('skip_track_source').setDescription("Skip using the track's source URL when searching for lyrics").setNameLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.options.skip_track_source.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.options.skip_track_source.description')).setRequired(false)),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.lyrics();
	},
};

export default lyricsCommand;
