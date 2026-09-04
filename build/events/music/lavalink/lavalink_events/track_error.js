"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const locales_1 = require("../../../../core/locales");
const music_1 = require("../../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.TrackError,
    execute: async (player, track, payload, client) => {
        try {
            if (!player?.guildId)
                return;
            const exception = payload?.exception;
            client.logger.error(`[LAVALINK] Track ${track?.title || 'Unknown'} (${track?.uri || 'no uri'}) failed on node ${player.node.options.identifier} in guild ${player.guildId}: ${exception?.message || 'no message'} | severity: ${exception?.severity || 'unknown'} | cause: ${exception?.cause || 'unknown'}`);
            const textChannel = client.channels.cache.get(String(player.textChannelId));
            if (!textChannel?.isTextBased())
                return;
            const locale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
            const message = client.localizationManager?.translate('responses.errors.play_error', locale) || 'An error occurred while processing the song';
            await (0, music_1.sendTempMessage)(textChannel, new music_1.MusicResponseHandler(client).createErrorContainer(message, locale), 15000);
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Error in trackError event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
