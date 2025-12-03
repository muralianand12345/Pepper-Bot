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
            const voiceStatus = new music_1.VoiceChannelStatus(client);
            await voiceStatus.clear(player.voiceChannelId || '');
            client.logger.debug(`[LAVALINK] Track ${track.title} ended in guild ${player.guildId} with reason: ${payload.reason}`);
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Error in trackEnd event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
