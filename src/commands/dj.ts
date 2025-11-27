import discord from 'discord.js';

import { Music } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const djCommand: Command = {
	cooldown: 120,
	category: CommandCategory.UTILITY,
	data: new discord.SlashCommandBuilder()
		.setName('dj')
		.setDescription('Manage DJ role for music commands')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.dj.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.dj.description'))
		.addRoleOption((option) => option.setName('role').setDescription('The role to set/remove as DJ role (leave empty to create/disable)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.dj.options.role.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.dj.options.role.description')).setRequired(false))
		.setDefaultMemberPermissions(discord.PermissionFlagsBits.ManageRoles)
		.setContexts(discord.InteractionContextType.Guild),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
		const music = new Music(client, interaction);
		await music.dj();
	},
};

export default djCommand;
