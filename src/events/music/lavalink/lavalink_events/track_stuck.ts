import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { LocaleDetector } from '../../../../core/locales';
import { sendTempMessage, MusicResponseHandler } from '../../../../core/music';

const localeDetector = new LocaleDetector();

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.TrackStuck,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackStuckEvent, client: discord.Client) => {
		try {
			if (!player?.guildId) return;

			client.logger.warn(`[LAVALINK] Track ${track?.title || 'Unknown'} (${track?.uri || 'no uri'}) got stuck for ${payload?.thresholdMs ?? 'unknown'}ms on node ${player.node.options.identifier} in guild ${player.guildId}`);

			const textChannel = client.channels.cache.get(String(player.textChannelId)) as discord.TextChannel;
			if (!textChannel?.isTextBased()) return;

			const locale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
			const message = client.localizationManager?.translate('responses.errors.play_error', locale) || 'An error occurred while processing the song';
			await sendTempMessage(textChannel, new MusicResponseHandler(client).createErrorContainer(message, locale), 15000);
		} catch (error) {
			client.logger.error(`[LAVALINK] Error in trackStuck event: ${error}`);
		}
	},
};

export default lavalinkEvent;
