import discord from 'discord.js';

import { send } from '../../../utils/msg';
import { BotEvent } from '../../../types';

const event: BotEvent = {
	name: discord.Events.GuildDelete,
	execute: async (guild: discord.Guild, client: discord.Client): Promise<void> => {
		try {
			const guildName = guild.name || 'Unknown Guild';
			const guildId = guild.id || 'Unknown ID';

			client.logger.info(`[SERVER_LEAVE] Left ${guildName} (${guildId})`);

			await Promise.allSettled([sendLogMessage(guild, client), sendFeedbackRequestDM(guild, client)]);
		} catch (error) {
			client.logger.error(`[SERVER_LEAVE] Error handling guild delete event: ${error}`);
		}
	},
};

const sendLogMessage = async (guild: discord.Guild, client: discord.Client): Promise<void> => {
	try {
		const logChannelId = client.config?.bot?.log?.server;
		if (!logChannelId) return client.logger.warn(`[SERVER_LEAVE] No log channel configured`);

		const logChannel = client.channels.cache.get(logChannelId) as discord.TextChannel;
		if (!logChannel) return client.logger.warn(`[SERVER_LEAVE] Log channel not found: ${logChannelId}`);
		if (!logChannel.isTextBased()) return client.logger.warn(`[SERVER_LEAVE] Log channel is not text-based: ${logChannelId}`);

		const leaveEmbed = new discord.EmbedBuilder()
			.setTitle('Server Left')
			.setDescription(`I have left **${guild.name || 'Unknown Guild'}** (${guild.id}). Now in **${client.guilds.cache.size}** servers.`)
			.addFields({ name: 'Members', value: guild.memberCount?.toString() || 'Unknown', inline: true }, { name: 'Owner', value: guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown Owner', inline: true }, { name: 'Created', value: guild.createdAt ? `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>` : 'Unknown Date', inline: true })
			.setColor('#ff0000')
			.setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
			.setTimestamp();

		if (guild.name) leaveEmbed.setAuthor({ name: guild.name.slice(0, 256), iconURL: guild.iconURL({ size: 128 }) || undefined });
		if (guild.iconURL()) leaveEmbed.setThumbnail(guild.iconURL({ size: 256 }));

		await send(client, logChannel.id, { embeds: [leaveEmbed] });
		client.logger.debug(`[SERVER_LEAVE] Log message sent successfully`);
	} catch (error) {
		client.logger.error(`[SERVER_LEAVE] Failed to send log message: ${error}`);
	}
};

const sendFeedbackRequestDM = async (guild: discord.Guild, client: discord.Client): Promise<void> => {
	if (!guild.ownerId) return client.logger.warn(`[FEEDBACK] Cannot send feedback DM - no owner ID for guild ${guild.id}`);

	try {
		const owner = await client.users.fetch(guild.ownerId).catch(() => null);
		if (!owner) return client.logger.warn(`[FEEDBACK] Cannot send feedback DM - owner not found for guild ${guild.id}`);

		const dmChannel = await owner.createDM().catch(() => null);
		if (!dmChannel) return client.logger.warn(`[FEEDBACK] Cannot create DM channel with owner ${guild.ownerId}`);

		const feedbackEmbed = new discord.EmbedBuilder()
			.setColor('#5865F2')
			.setTitle('Your Feedback Matters!')
			.setDescription(`Thank you for trying ${client.user?.username || 'Music Bot'}! We noticed the bot is no longer in your server.\n\n` + "We'd love to hear your feedback to improve our service. Your insights are valuable to us!")
			.setFooter({ text: `${client.user?.username || 'Music Bot'}`, iconURL: client.user?.displayAvatarURL() || undefined });

		if (client.user?.displayAvatarURL()) feedbackEmbed.setThumbnail(client.user.displayAvatarURL({ size: 128 }));

		const actionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
			new discord.ButtonBuilder().setCustomId(`feedback_request_${guild.id}`).setLabel('Share Feedback').setStyle(discord.ButtonStyle.Primary).setEmoji('📝'),
			new discord.ButtonBuilder()
				.setLabel(`Re-Invite ${client.user?.username || 'Bot'}`)
				.setStyle(discord.ButtonStyle.Link)
				.setURL(`https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`)
				.setEmoji('🎵'),
			new discord.ButtonBuilder().setLabel('Support Server').setStyle(discord.ButtonStyle.Link).setURL(client.config.bot.support_server.invite).setEmoji('🔧')
		);

		await send(client, dmChannel.id, { content: `Hello! This is **${client.user?.username || 'Music Bot'}**, the music bot that was recently removed from **${guild.name || 'your server'}**.`, embeds: [feedbackEmbed], components: [actionRow] });
		client.logger.info(`[FEEDBACK] Sent feedback request DM to ${owner.tag} (${owner.id}) for guild ${guild.name || guild.id}`);
	} catch (error) {
		if (error instanceof discord.DiscordAPIError) {
			switch (error.code) {
				case 10013:
					client.logger.warn(`[FEEDBACK] User not found for guild ${guild.id} (owner ID: ${guild.ownerId})`);
					break;
				case 50007:
					client.logger.warn(`[FEEDBACK] Cannot send DM to ${guild.ownerId} - user has DMs disabled`);
					break;
				case 50001:
					client.logger.warn(`[FEEDBACK] Missing access to send DM to ${guild.ownerId}`);
					break;
				case 40002:
					client.logger.warn(`[FEEDBACK] Cannot send DM to ${guild.ownerId} - not friends or in mutual server`);
					break;
				case 50035:
					client.logger.warn(`[FEEDBACK] Invalid form body when sending DM to ${guild.ownerId}`);
					break;
				default:
					client.logger.warn(`[FEEDBACK] Discord API error ${error.code}: ${error.message} when sending DM to ${guild.ownerId}`);
			}
		} else {
			client.logger.warn(`[FEEDBACK] Unexpected error sending feedback DM to ${guild.ownerId}: ${error}`);
		}
	}
};

export default event;
