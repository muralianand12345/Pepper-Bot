import discord from 'discord.js';
import magmastream from 'magmastream';

import { send } from '../../utils/msg';
import { v2 } from '../../utils/v2';
import { sendTempMessage } from './func';
import { LocaleDetector } from '../locales';
import { VoiceChannelStatus } from './utils';
import { markPaused } from './stream_refresh';
import { MusicResponseHandler } from './handlers';
import { NowPlayingManager } from './now_playing';

const DISCONNECT_DELAY = 5 * 60 * 1000; // 5 minutes

const localeDetector = new LocaleDetector();

export const countListeners = (client: discord.Client, voiceChannelId: string | null | undefined): number | null => {
	const channel = voiceChannelId ? client.channels.cache.get(voiceChannelId) : null;
	if (!channel?.isVoiceBased()) return null;
	return channel.members.filter((member) => !member.user.bot).size;
};

const getGuildLocale = async (guildId: string): Promise<string> => {
	try {
		return (await localeDetector.getGuildLanguage(guildId)) || 'en';
	} catch (error) {
		return 'en';
	}
};

const getTextChannel = (client: discord.Client, player: magmastream.Player): discord.TextChannel | null => {
	const channel = player.textChannelId ? client.channels.cache.get(player.textChannelId) : null;
	return channel?.isTextBased() ? (channel as discord.TextChannel) : null;
};

export const handleEmptyVoiceChannel = async (player: magmastream.Player, client: discord.Client): Promise<void> => {
	const guildLocale = await getGuildLocale(player.guildId);
	const textChannel = getTextChannel(client, player);

	if (!player.paused && player.playing) {
		const currentTrack = await player.queue.getCurrent();
		await player.pause(true);
		markPaused(player.guildId);
		if (currentTrack) await new VoiceChannelStatus(client).setPaused(player, currentTrack);
		NowPlayingManager.getInstance(player.guildId, player, client).onPause();
		if (textChannel) {
			const responseHandler = new MusicResponseHandler(client);
			const container = responseHandler.createPlayerStateContainer('paused', client.localizationManager?.translate('responses.music.paused_empty_channel', guildLocale) || '⏸️ Paused playback because the voice channel is empty');
			await sendTempMessage(textChannel, container);
		}
	}

	const scheduledAt = Date.now();
	player.cleanupScheduledAt = scheduledAt;

	client.logger.info(`[VOICE_STATE] Voice channel empty in guild ${player.guildId}, scheduling disconnect in 5 minutes`);

	setTimeout(async () => {
		try {
			const currentPlayer = client.manager.getPlayer(player.guildId);
			if (!currentPlayer) return;
			if (currentPlayer.cleanupScheduledAt !== scheduledAt) return;

			const voiceChannelId = currentPlayer.voiceChannelId;
			if ((countListeners(client, voiceChannelId) ?? 0) > 0) return;

			client.logger.info(`[VOICE_STATE] Voice channel still empty after 5 minutes, disconnecting from guild ${player.guildId}`);

			const nowPlayingManager = NowPlayingManager.getInstance(player.guildId, currentPlayer, client);
			await nowPlayingManager.disableButtons();

			const currentTextChannel = getTextChannel(client, currentPlayer);
			if (currentTextChannel) {
				const responseHandler = new MusicResponseHandler(client);
				const disconnectContainer = responseHandler.createPlayerStateContainer('disconnected', client.localizationManager?.translate('responses.music.disconnected_inactivity', guildLocale) || '🔌 Disconnecting due to inactivity (5 minutes with no listeners)');
				await send(client, currentTextChannel.id, v2(disconnectContainer)).catch((err) => client.logger.warn(`[VOICE_STATE] Failed to send disconnect message: ${err}`));
			}
			NowPlayingManager.removeInstance(player.guildId);

			await currentPlayer.destroy();
			if (voiceChannelId) await new VoiceChannelStatus(client).clear(voiceChannelId);
		} catch (error) {
			client.logger.error(`[VOICE_STATE] Error during auto-disconnect: ${error}`);
		}
	}, DISCONNECT_DELAY);
};
