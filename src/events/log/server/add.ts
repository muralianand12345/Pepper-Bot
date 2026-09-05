import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { sendChannelWebhook } from '../../../utils/webhook';
import { getGlobalGuildCount, invalidateStatsCache } from '../../../utils/shard';
import { v2Webhook, panel, fields } from '../../../utils/v2';

const truncateText = (text: string, maxLength: number = 100): string => {
	if (!text) return 'Unknown';
	return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
};

const event: BotEvent = {
	name: discord.Events.GuildCreate,
	execute: async (guild: discord.Guild, client: discord.Client): Promise<void> => {
		try {
			const guildName = truncateText(guild.name || 'Unknown Guild', 50);
			const guildId = guild.id || 'Unknown ID';

			client.logger.info(`[SERVER_JOIN] Joined ${guildName} (${guildId})`);

			invalidateStatsCache();
			const totalGuilds = await getGlobalGuildCount(client);

			const details = fields([
				guild.memberCount !== undefined && guild.memberCount !== null ? ['Members', guild.memberCount.toString()] : null,
				guild.ownerId ? ['Owner', `<@${guild.ownerId}>`] : null,
				guild.createdAt ? ['Created', `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>`] : null,
			]);

			const container = panel(0x00ff00, {
				title: 'New Server Joined',
				body: [`I have joined **${guildName}** (${guildId}).`, details].filter(Boolean).join('\n\n'),
				thumbnail: guild.iconURL({ size: 256 }),
				footer: `Now in ${totalGuilds.toLocaleString()} servers`,
				timestamp: true,
			});

			try {
				const logChannelId = client.config?.bot?.log?.server;
				if (!logChannelId) return client.logger.warn(`[SERVER_JOIN] No log channel configured`);

				await sendChannelWebhook(client, logChannelId.toString(), { ...v2Webhook(container), username: `${client.user?.username || 'Pepper'} Logs`, avatarURL: client.user?.displayAvatarURL() });
				client.logger.debug(`[SERVER_JOIN] Log message sent successfully`);
			} catch (logError) {
				if (logError instanceof discord.DiscordAPIError) {
					client.logger.error(`[SERVER_JOIN] Discord API error ${logError.code}: ${logError.message}`);
				} else {
					client.logger.error(`[SERVER_JOIN] Failed to send log message: ${logError}`);
				}
			}
		} catch (error) {
			client.logger.error(`[SERVER_JOIN] Error handling guild create event: ${error}`);
		}
	},
};

export default event;
