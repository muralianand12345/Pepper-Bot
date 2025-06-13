import discord from 'discord.js';

import { Command } from '../types';
import { Music } from '../core/music';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const autoplayCommand: Command = {
	cooldown: 5,
	data: new discord.SlashCommandBuilder()
		.setName('autoplay')
		.setDescription('Toggle smart autoplay based on your music preferences')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addBooleanOption((option) =>
			option
				.setName('enabled')
				.setDescription('Enable or disable autoplay')
				.setNameLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.options.enabled.name'))
				.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.options.enabled.description'))
				.setRequired(true)
		),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
		const music = new Music(client, interaction);
		const enabled = interaction.options.getBoolean('enabled', true);
		await music.autoplay(enabled);
	},
};

export default autoplayCommand;
