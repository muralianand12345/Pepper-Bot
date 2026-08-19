import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { LocaleDetector } from '../../../../core/locales';
import { sendTempMessage, MusicResponseHandler } from '../../../../core/music';

const localeDetector = new LocaleDetector();

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.TrackError,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackExceptionEvent, client: discord.Client) => {
		try {
			if (!player?.guildId) return;

			const exception = payload?.exception;
			client.logger.error(`[LAVALINK] Track ${track?.title || 'Unknown'} (${track?.uri || 'no uri'}) failed on node ${player.node.options.identifier} in guild ${player.guildId}: ${exception?.message || 'no message'} | severity: ${exception?.severity || 'unknown'} | cause: ${exception?.cause || 'unknown'}`);

			const textChannel = client.channels.cache.get(String(player.textChannelId)) as discord.TextChannel;
			if (!textChannel?.isTextBased()) return;

			const locale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
			const message = client.localizationManager?.translate('responses.errors.play_error', locale) || 'An error occurred while processing the song';
			await sendTempMessage(textChannel, new MusicResponseHandler(client).createErrorEmbed(message, locale), 15000);
		} catch (error) {
			client.logger.error(`[LAVALINK] Error in trackError event: ${error}`);
		}
	},
};

export default lavalinkEvent;
