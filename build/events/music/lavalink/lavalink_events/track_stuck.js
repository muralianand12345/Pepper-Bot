"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const locales_1 = require("../../../../core/locales");
const music_1 = require("../../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.TrackStuck,
    execute: async (player, track, payload, client) => {
        try {
            if (!player?.guildId)
                return;
            client.logger.warn(`[LAVALINK] Track ${track?.title || 'Unknown'} (${track?.uri || 'no uri'}) got stuck for ${payload?.thresholdMs ?? 'unknown'}ms on node ${player.node.options.identifier} in guild ${player.guildId}`);
            const failure = (0, music_1.recordFailure)(player.guildId);
            client.logger.warn(`[LAVALINK] Playback failure ${failure.count}/${music_1.FAILURE_LIMIT} for guild ${player.guildId}; next attempt held for ${failure.backoffMs}ms`);
            const textChannel = client.channels.cache.get(String(player.textChannelId));
            const locale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
            const message = client.localizationManager?.translate('responses.errors.play_error', locale) || 'An error occurred while processing the song';
            if (failure.tripped) {
                client.logger.warn(`[LAVALINK] Abandoning queue for guild ${player.guildId} after ${failure.count} consecutive failures`);
                if (textChannel?.isTextBased())
                    await (0, music_1.sendTempMessage)(textChannel, new music_1.MusicResponseHandler(client).createPlayerStateContainer('stopped', message, `Stopped after ${failure.count} tracks failed in a row.`), 30000);
                await (0, music_1.abandonQueue)(player, client);
                return;
            }
            if (!textChannel?.isTextBased())
                return;
            await (0, music_1.sendTempMessage)(textChannel, new music_1.MusicResponseHandler(client).createErrorContainer(message, locale), 15000);
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Error in trackStuck event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
