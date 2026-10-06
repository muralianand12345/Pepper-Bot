import discord from 'discord.js';

import { Command } from '../types';
import { clearUserBanCache } from '../core/commands';
import { v2Ephemeral, panel, fields } from '../utils/v2';
import user_ban from '../events/database/schema/user_ban';

const unbanCommand: Command = {
	owner: true,
	data: new discord.SlashCommandBuilder()
		.setName('unban')
		.setDescription('Lift a user ban from the bot')
		.addUserOption((option) => option.setName('user').setDescription('The user to unban').setRequired(true))
		.setDefaultMemberPermissions(0)
		.setContexts(discord.InteractionContextType.Guild),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
		const user = interaction.options.getUser('user', true);

		const ban = await user_ban.findOneAndDelete({ userId: user.id });
		clearUserBanCache(user.id);

		if (!ban) return await interaction.reply(v2Ephemeral(panel(0xfee75c, { body: `⚠️ ${user} is not banned.` })));

		client.logger.info(`[BAN] ${interaction.user.tag} unbanned ${user.tag} (${user.id})`);

		return await interaction.reply(
			v2Ephemeral(
				panel(0x57f287, {
					title: '✅ User unbanned',
					body: fields([
						['User', `${user} (\`${user.id}\`)`],
						['Previous reason', ban.reason],
					]),
					timestamp: true,
				}),
			),
		);
	},
};

export default unbanCommand;
