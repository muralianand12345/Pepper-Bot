import discord from 'discord.js';

import { Music } from '../core/music';

export default {
	data: new discord.SlashCommandBuilder()
		.setName('dj')
		.setDescription('Manage DJ role for music commands')
		.addRoleOption((option) => option.setName('role').setDescription('The role to set/remove as DJ role').setRequired(true))
		.setDefaultMemberPermissions(discord.PermissionFlagsBits.ManageRoles)
		.setContexts(discord.InteractionContextType.Guild),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
		const music = new Music(client, interaction);
		await music.dj();
	},
};
