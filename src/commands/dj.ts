import discord from 'discord.js';

import { Music } from '../core/music';
import { Command, CommandCategory } from '../types';

const djCommand: Command = {
	cooldown: 120,
	category: CommandCategory.UTILITY,
	data: new discord.SlashCommandBuilder()
		.setName('dj')
		.setDescription('Manage DJ role for music commands')
		.addRoleOption((option) => option.setName('role').setDescription('The role to set/remove as DJ role (leave empty to create/disable)').setRequired(false))
		.setDefaultMemberPermissions(discord.PermissionFlagsBits.ManageRoles)
		.setContexts(discord.InteractionContextType.Guild),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
		const music = new Music(client, interaction);
		await music.dj();
	},
};

export default djCommand;