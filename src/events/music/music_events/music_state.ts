import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { LocaleDetector } from '../../../core/locales';
import { NowPlayingManager, MusicResponseHandler, sendTempMessage, VoiceChannelStatus, clearPaused, isStreamStale, refreshStream, countListeners, handleEmptyVoiceChannel } from '../../../core/music';

const localeDetector = new LocaleDetector();

const event: BotEvent = {
	name: discord.Events.VoiceStateUpdate,
	execute: async (oldState: discord.VoiceState, newState: discord.VoiceState, client: discord.Client): Promise<void> => {
		if (!client.config.music.enabled) return;
		const player = client.manager.getPlayer(newState.guild.id);
		if (!player || player.state !== 'CONNECTED' || !player.voiceChannelId) return;

		if (newState.id === client.user?.id) {
			if (!newState.channelId || !oldState.channelId || newState.channelId === oldState.channelId) return;

			client.logger.info(`[VOICE_STATE] Bot was moved to different voice channel in guild ${newState.guild.id}`);
			if (player.voiceChannelId !== newState.channelId) player.voiceChannelId = newState.channelId;
			if (countListeners(client, newState.channelId) === 0) await handleEmptyVoiceChannel(player, client);
			return;
		}

		if ((newState.member ?? oldState.member)?.user.bot) return;

		const channelId = player.voiceChannelId;
		const joined = newState.channelId === channelId && oldState.channelId !== channelId;
		const left = oldState.channelId === channelId && newState.channelId !== channelId;
		if (!joined && !left) return;

		const memberCount = countListeners(client, channelId);
		if (memberCount === null) return;

		if (left && memberCount === 0) return handleEmptyVoiceChannel(player, client);

		if (joined && memberCount === 1 && player.paused) {
			const currentTrack = await player.queue.getCurrent();
			const streamWentStale = isStreamStale(player.guildId);
			await player.pause(false);
			clearPaused(player.guildId);
			if (streamWentStale) await refreshStream(player, client, 'resumed when a listener rejoined');
			if (currentTrack) await new VoiceChannelStatus(client).setPlaying(player, currentTrack);
			NowPlayingManager.getInstance(player.guildId, player, client).onResume();

			const textChannel = client.channels.cache.get(String(player.textChannelId)) as discord.TextChannel;
			if (!textChannel) return;

			let guildLocale = 'en';
			try {
				guildLocale = (await localeDetector.getGuildLanguage(newState.guild.id)) || 'en';
			} catch (error) {}

			const responseHandler = new MusicResponseHandler(client);
			const container = responseHandler.createPlayerStateContainer('playing', client.localizationManager?.translate('responses.music.resumed_members_joined', guildLocale) || '▶️ Resumed playback');
			await sendTempMessage(textChannel, container);
		}
	},
};

export default event;
