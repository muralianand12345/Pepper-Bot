import ms from 'ms';
import discord from 'discord.js';

import { Command } from '../types';
import { clearUserBanCache } from '../core/commands';
import { v2Ephemeral, panel, fields } from '../utils/v2';
import user_ban from '../events/database/schema/user_ban';

const banCommand: Command = {
	owner: true,
	data: new discord.SlashCommandBuilder()
		.setName('ban')
		.setDescription('Ban a user from using the bot')
		.addUserOption((option) => option.setName('user').setDescription('The user to ban').setRequired(true))
		.addStringOption((option) => option.setName('reason').setDescription('Why the user is being banned').setMaxLength(500).setRequired(true))
		.addStringOption((option) => option.setName('duration').setDescription('How long the ban lasts, e.g. 7d or 12h (leave empty for permanent)').setRequired(false))
		.setDefaultMemberPermissions(0)
		.setContexts(discord.InteractionContextType.Guild),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
		const user = interaction.options.getUser('user', true);
		const reason = interaction.options.getString('reason', true);
		const duration = interaction.options.getString('duration');

		if (user.id === interaction.user.id || client.config.bot.owners.includes(user.id)) return await interaction.reply(v2Ephemeral(panel(0xed4245, { body: '❌ Bot owners cannot be banned.' })));

		const durationMs = duration ? ms(duration as ms.StringValue) : null;
		if (duration && (typeof durationMs !== 'number' || durationMs <= 0)) return await interaction.reply(v2Ephemeral(panel(0xed4245, { body: `❌ Invalid duration \`${duration}\`. Use formats like \`30m\`, \`12h\` or \`7d\`.` })));

		const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;
		await user_ban.findOneAndUpdate({ userId: user.id }, { reason, bannedBy: interaction.user.id, expiresAt }, { upsert: true, setDefaultsOnInsert: true });
		clearUserBanCache(user.id);

		client.logger.info(`[BAN] ${interaction.user.tag} banned ${user.tag} (${user.id}) ${expiresAt ? `until ${expiresAt.toISOString()}` : 'permanently'}: ${reason}`);

		return await interaction.reply(
			v2Ephemeral(
				panel(0xed4245, {
					title: '🚫 User banned',
					body: fields([
						['User', `${user} (\`${user.id}\`)`],
						['Reason', reason],
						['Expires', expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F> (<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)` : 'Never'],
					]),
					timestamp: true,
				}),
			),
		);
	},
};

export default banCommand;
