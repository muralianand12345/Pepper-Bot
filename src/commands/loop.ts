import discord from 'discord.js';

import { Command } from '../types';
import { Music } from '../core/music';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const loopCommand: Command = {
	cooldown: 120,
	category: ['music'],
	data: new discord.SlashCommandBuilder().setName('loop').setDescription('Toggle loop mode for the current track').setNameLocalizations(localizationManager.getCommandLocalizations('commands.loop.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.loop.description')),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.loop();
	},
};

export default loopCommand;
