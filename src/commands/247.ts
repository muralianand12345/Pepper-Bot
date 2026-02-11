import discord from 'discord.js';

import { Music } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const twentyFourSevenCommand: Command = {
	cooldown: 5,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder().setName('24-7').setDescription('Toggle 24/7 mode to keep the bot in the voice channel').setNameLocalizations(localizationManager.getCommandLocalizations('commands.24-7.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.24-7.description')).setContexts(discord.InteractionContextType.Guild),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.twentyFourSeven();
	},
};

export default twentyFourSevenCommand;
