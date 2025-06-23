import discord from 'discord.js';

import { BotEvent } from '../../../types';

const event: BotEvent = {
	name: discord.Events.GuildCreate,
	execute: async (guild: discord.Guild, client: discord.Client): Promise<void> => {
		try {
			client.logger.info(`[SERVER_JOIN] Joined ${guild.name} (${guild.id})`);

			const embed = new discord.EmbedBuilder()
				.setTitle('New Server Joined')
				.setAuthor({ name: guild.name, iconURL: guild.iconURL() || '' })
				.setDescription(`I have joined **${guild.name}** (${guild.id}). Now in **${client.guilds.cache.size}** servers.`)
				.addFields({ name: 'Members', value: guild.memberCount?.toString() || 'Unknown', inline: true }, { name: 'Owner', value: guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown Owner', inline: true }, { name: 'Created', value: guild.createdAt?.toDateString() || 'Unknown Date', inline: true })
				.setThumbnail(guild.iconURL() || null)
				.setColor('Green')
				.setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
				.setTimestamp();

			try {
				const logChannel = client.channels.cache.get(client.config.bot.log.server) as discord.TextChannel;
				if (logChannel?.isTextBased()) {
					await logChannel.send({ embeds: [embed] });
				} else {
					client.logger.warn(`[SERVER_JOIN] Log channel not found or not text-based: ${client.config.bot.log.server}`);
				}
			} catch (logError) {
				client.logger.error(`[SERVER_JOIN] Failed to send log message: ${logError}`);
			}
		} catch (error) {
			client.logger.error(`[SERVER_JOIN] Error handling guild create event: ${error}`);
		}
	},
};

export default event;
