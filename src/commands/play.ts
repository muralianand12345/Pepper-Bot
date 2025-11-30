import discord from 'discord.js';

import { Music } from '../core/music';
import { AutoComplete } from '../core/commands';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const playCommand: Command = {
	cooldown: 1,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a song via song name or url')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addStringOption((option) => option.setName('song').setDescription('Song Name/URL').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.description')).setRequired(true).setAutocomplete(true)),
	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		const autoComplete = new AutoComplete(client, interaction);
		await autoComplete.playAutocomplete();
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.play();
	},
};

export default playCommand;
