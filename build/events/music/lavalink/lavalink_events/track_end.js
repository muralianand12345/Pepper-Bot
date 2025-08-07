"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const music_1 = require("../../../../core/music");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.TrackEnd,
    execute: async (player, track, payload, client) => {
        try {
            if (!player?.guildId)
                return;
            client.logger.debug(`[LAVALINK] Track ${track.title} ended in guild ${player.guildId} with reason: ${payload.reason}`);
            const finishedNaturally = payload.reason === 'finished';
            const queueIsNearlyEmpty = player.queue.size < 2;
            if (finishedNaturally && queueIsNearlyEmpty) {
                const autoplayManager = music_1.Autoplay.getInstance(player.guildId, player, client);
                if (autoplayManager.isEnabled()) {
                    const autoplaySuccessful = await autoplayManager.processTrack(track);
                    if (!autoplaySuccessful) {
                        client.logger.warn(`[LAVALINK] Autoplay failed to add tracks for guild ${player.guildId}`);
                    }
                }
            }
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Error in trackEnd event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
