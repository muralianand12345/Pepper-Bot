import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { LocaleDetector } from '../../../../core/locales';
import { wait, NowPlayingManager, MusicResponseHandler } from '../../../../core/music';

const localeDetector = new LocaleDetector();

const createQueueEndEmbed = (client: discord.Client, locale: string = 'en'): discord.EmbedBuilder => {
	const responseHandler = new MusicResponseHandler(client);
	return responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.queue_empty', locale) || '🎵 Played all music in queue', locale);
};

const validateChannelAccess = async (client: discord.Client, channelId: string): Promise<discord.TextChannel | null> => {
	try {
		const channel = await client.channels.fetch(channelId);
		if (!channel) {
			client.logger.warn(`[QUEUE_END] Channel ${channelId} not found`);
			return null;
		}

		if (!channel.isTextBased()) {
			client.logger.warn(`[QUEUE_END] Channel ${channelId} is not text-based`);
			return null;
		}

		const textChannel = channel as discord.TextChannel;
		const guild = textChannel.guild;
		const botMember = guild.members.me;

		if (!botMember) {
			client.logger.warn(`[QUEUE_END] Bot member not found in guild ${guild.id}`);
			return null;
		}

		const permissions = textChannel.permissionsFor(botMember);
		if (!permissions || !permissions.has([discord.PermissionsBitField.Flags.ViewChannel, discord.PermissionsBitField.Flags.SendMessages])) {
			client.logger.warn(`[QUEUE_END] Missing permissions for channel ${channelId} in guild ${guild.id}`);
			return null;
		}

		return textChannel;
	} catch (error) {
		if (error instanceof discord.DiscordAPIError) {
			switch (error.code) {
				case 10003:
					client.logger.warn(`[QUEUE_END] Channel ${channelId} not found (deleted)`);
					break;
				case 50001:
					client.logger.warn(`[QUEUE_END] Missing access to channel ${channelId}`);
					break;
				case 50013:
					client.logger.warn(`[QUEUE_END] Missing permissions for channel ${channelId}`);
					break;
				default:
					client.logger.warn(`[QUEUE_END] Discord API error ${error.code} for channel ${channelId}: ${error.message}`);
			}
		} else {
			client.logger.error(`[QUEUE_END] Error validating channel access: ${error}`);
		}
		return null;
	}
};

const sendQueueEndMessage = async (client: discord.Client, channel: discord.TextChannel, locale: string): Promise<void> => {
	try {
		const queueEndEmbed = createQueueEndEmbed(client, locale);
		await channel.send({ embeds: [queueEndEmbed] });
		client.logger.debug(`[QUEUE_END] Queue end message sent for guild ${channel.guild.id}`);
	} catch (error) {
		if (error instanceof discord.DiscordAPIError) {
			switch (error.code) {
				case 50001:
					client.logger.warn(`[QUEUE_END] Missing access to send message in channel ${channel.id}`);
					break;
				case 50013:
					client.logger.warn(`[QUEUE_END] Missing permissions to send message in channel ${channel.id}`);
					break;
				case 10003:
					client.logger.warn(`[QUEUE_END] Channel ${channel.id} was deleted while trying to send message`);
					break;
				default:
					client.logger.error(`[QUEUE_END] Discord API error ${error.code} sending message: ${error.message}`);
			}
		} else {
			client.logger.error(`[QUEUE_END] Error sending queue end message: ${error}`);
		}
	}
};

const handlePlayerCleanup = async (player: magmastream.Player, guildId: string, client: discord.Client): Promise<void> => {
	const nowPlayingManager = NowPlayingManager.getInstance(guildId, player, client);
	nowPlayingManager.onStop();

	const CLEANUP_DELAY = 120000; // Reduced to 2 minutes for faster cleanup when autoplay fails
	const CLEANUP_DELAY_MINS = CLEANUP_DELAY / 60000;

	const scheduledAt = Date.now();
	player.cleanupScheduledAt = scheduledAt;

	client.logger.info(`[QUEUE_END] Scheduled cleanup for guild ${guildId} in ${CLEANUP_DELAY_MINS} minutes`);

	await wait(CLEANUP_DELAY);

	const currentPlayer = client.manager.getPlayer(guildId);
	if (!currentPlayer) return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} already destroyed, skipping cleanup`);
	if (currentPlayer.cleanupScheduledAt !== scheduledAt) return client.logger.debug(`[QUEUE_END] Cleanup task for guild ${guildId} has been superseded, skipping`);
	if (currentPlayer.playing || (await currentPlayer.queue.getCurrent())) return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} is active again, skipping cleanup`);

	NowPlayingManager.removeInstance(guildId);

	client.logger.info(`[QUEUE_END] Performing cleanup for guild ${guildId} after ${CLEANUP_DELAY_MINS} minutes of inactivity`);
	currentPlayer.destroy();
};

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.QueueEnd,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackEndEvent, client: discord.Client): Promise<void> => {
		if (!player?.textChannelId || !client?.channels) return client.logger.warn(`[QUEUE_END] Missing player textChannelId or client channels for guild ${player?.guildId}`);

		try {
			const channel = await validateChannelAccess(client, player.textChannelId);
			if (!channel) {
				client.logger.warn(`[QUEUE_END] Cannot access text channel ${player.textChannelId} for guild ${player.guildId}, skipping message`);
			} else {
				let guildLocale = 'en';
				try {
					guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
				} catch (error) {
					client.logger.warn(`[QUEUE_END] Error getting guild locale: ${error}`);
				}

				await sendQueueEndMessage(client, channel, guildLocale);
			}

			await handlePlayerCleanup(player, player.guildId, client);
		} catch (error) {
			client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
		}
	},
};

export default lavalinkEvent;
