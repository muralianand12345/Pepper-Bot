import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { LocaleDetector } from '../../../../core/locales';
import { sendTempMessage, MusicResponseHandler, recordFailure, abandonQueue, FAILURE_LIMIT } from '../../../../core/music';

const localeDetector = new LocaleDetector();

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.TrackStuck,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackStuckEvent, client: discord.Client) => {
		try {
			if (!player?.guildId) return;

			client.logger.warn(`[LAVALINK] Track ${track?.title || 'Unknown'} (${track?.uri || 'no uri'}) got stuck for ${payload?.thresholdMs ?? 'unknown'}ms on node ${player.node.options.identifier} in guild ${player.guildId}`);

			const failure = recordFailure(player.guildId);
			client.logger.warn(`[LAVALINK] Playback failure ${failure.count}/${FAILURE_LIMIT} for guild ${player.guildId}; next attempt held for ${failure.backoffMs}ms`);

			const textChannel = client.channels.cache.get(String(player.textChannelId)) as discord.TextChannel;
			const locale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
			const message = client.localizationManager?.translate('responses.errors.play_error', locale) || 'An error occurred while processing the song';

			if (failure.tripped) {
				client.logger.warn(`[LAVALINK] Abandoning queue for guild ${player.guildId} after ${failure.count} consecutive failures`);
				if (textChannel?.isTextBased()) await sendTempMessage(textChannel, new MusicResponseHandler(client).createPlayerStateContainer('stopped', message, `Stopped after ${failure.count} tracks failed in a row.`), 30000);
				await abandonQueue(player, client);
				return;
			}

			if (!textChannel?.isTextBased()) return;
			await sendTempMessage(textChannel, new MusicResponseHandler(client).createErrorContainer(message, locale), 15000);
		} catch (error) {
			client.logger.error(`[LAVALINK] Error in trackStuck event: ${error}`);
		}
	},
};

export default lavalinkEvent;
