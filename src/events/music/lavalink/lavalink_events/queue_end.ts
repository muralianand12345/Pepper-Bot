import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { LocaleDetector } from '../../../../core/locales';
import { wait, Autoplay, NowPlayingManager, MusicResponseHandler } from '../../../../core/music';

const localeDetector = new LocaleDetector();

const createQueueEndEmbed = (client: discord.Client, locale: string = 'en'): discord.EmbedBuilder => {
	const responseHandler = new MusicResponseHandler(client);
	return responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.queue_empty', locale) || '🎵 Played all music in queue', locale);
};

const shouldAutoplayKeepAlive = (player: magmastream.Player, guildId: string, client: discord.Client): boolean => {
	try {
		const autoplayManager = Autoplay.getInstance(guildId, player, client);
		return autoplayManager.isEnabled();
	} catch (error) {
		client.logger.error(`[QUEUE_END] Error checking autoplay status: ${error}`);
		return false;
	}
};

const hasRequiredPermissions = (channel: discord.TextChannel, client: discord.Client): boolean => {
	try {
		if (!channel.guild.members.me) return false;
		
		const botPermissions = channel.permissionsFor(client.user!);
		if (!botPermissions) return false;
		
		return botPermissions.has([discord.PermissionsBitField.Flags.SendMessages, discord.PermissionsBitField.Flags.EmbedLinks]);
	} catch (error) {
		return false;
	}
};

const handlePlayerCleanup = async (player: magmastream.Player, guildId: string, client: discord.Client): Promise<void> => {
	if (shouldAutoplayKeepAlive(player, guildId, client)) return client.logger.info(`[QUEUE_END] Autoplay is enabled, keeping player alive for guild ${guildId}`);
	
	const nowPlayingManager = NowPlayingManager.getInstance(guildId, player, client);
	nowPlayingManager.onStop();

	const CLEANUP_DELAY = 300000;
	const CLEANUP_DELAY_MINS = CLEANUP_DELAY / 60000;

	const scheduledAt = Date.now();
	player.cleanupScheduledAt = scheduledAt;

	client.logger.info(`[QUEUE_END] Scheduled cleanup for guild ${guildId} in ${CLEANUP_DELAY_MINS} minutes`);

	await wait(CLEANUP_DELAY);

	const currentPlayer = client.manager.get(guildId);
	if (!currentPlayer) return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} already destroyed, skipping cleanup`);
	if (currentPlayer.cleanupScheduledAt !== scheduledAt) return client.logger.debug(`[QUEUE_END] Cleanup task for guild ${guildId} has been superseded, skipping`);
	if (currentPlayer.playing || currentPlayer.queue.current) return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} is active again, skipping cleanup`);

	NowPlayingManager.removeInstance(guildId);
	Autoplay.removeInstance(guildId);

	client.logger.info(`[QUEUE_END] Performing cleanup for guild ${guildId} after ${CLEANUP_DELAY_MINS} minutes of inactivity`);
	player.destroy();
};

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.QueueEnd,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackEndEvent, client: discord.Client): Promise<void> => {
		if (!player?.textChannelId || !client?.channels) return;

		try {
			const channel = (await client.channels.fetch(player.textChannelId)) as discord.TextChannel;
			if (!channel?.isTextBased()) {
				client.logger.warn(`[QUEUE_END] Channel ${player.textChannelId} is not accessible or not text-based for guild ${player.guildId}`);
				await handlePlayerCleanup(player, player.guildId, client);
				return;
			}

			const autoplayManager = Autoplay.getInstance(player.guildId, player, client);
			if (autoplayManager.isEnabled() && track) {
				const processed = await autoplayManager.processTrack(track);
				if (processed) return client.logger.info(`[QUEUE_END] Autoplay added tracks for guild ${player.guildId}`);
			}

			try {
				// Check bot permissions before attempting to send message
				if (!hasRequiredPermissions(channel as discord.TextChannel, client)) {
					client.logger.warn(`[QUEUE_END] Bot lacks SendMessages or EmbedLinks permission in channel ${channel.id} for guild ${player.guildId}`);
				} else {
					let guildLocale = 'en';
					try {
						guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
					} catch (error) {}

					const queueEndEmbed = createQueueEndEmbed(client, guildLocale);
					await channel.send({ embeds: [queueEndEmbed] });

					client.logger.debug(`[QUEUE_END] Queue end message sent for guild ${player.guildId}`);
				}
			} catch (messageError) {
				if (messageError instanceof discord.DiscordAPIError) {
					switch (messageError.code) {
						case 50001:
						case 50013:
							client.logger.warn(`[QUEUE_END] Missing permissions to send message (${messageError.code}) in guild ${player.guildId}`);
							break;
						case 10003:
						case 10008:
							client.logger.warn(`[QUEUE_END] Channel or message deleted (${messageError.code}) in guild ${player.guildId}`);
							break;
						default:
							client.logger.error(`[QUEUE_END] Discord API error ${messageError.code} when sending queue end message: ${messageError.message}`);
					}
				} else {
					client.logger.error(`[QUEUE_END] Failed to send queue end message: ${messageError}`);
				}
			}

			await handlePlayerCleanup(player, player.guildId, client);
		} catch (error) {
			client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
		}
	},
};

export default lavalinkEvent;
