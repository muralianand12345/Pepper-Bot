import discord from 'discord.js';

import { Music } from '../core/music';
import { AutoComplete } from '../core/commands';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const radioCommand: Command = {
	cooldown: 5,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('radio')
		.setDescription('Play a live radio station')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addStringOption((option) => option.setName('station').setDescription('Station name, genre or frequency').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.station.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.station.description')).setRequired(true).setAutocomplete(true)),
	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		const autoComplete = new AutoComplete(client, interaction);
		await autoComplete.radioAutocomplete();
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.radio(interaction.options.getString('station', true));
	},
};

export default radioCommand;
