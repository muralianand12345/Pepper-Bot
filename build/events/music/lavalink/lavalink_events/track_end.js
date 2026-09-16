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
            if ((0, music_1.isRadioActive)(player.guildId) && payload.reason !== 'replaced' && payload.reason !== 'stopped') {
                const result = await (0, music_1.reconnectRadio)(player, client, `track end (${payload.reason})`);
                await (0, music_1.notifyRadioRecovery)(client, player, result);
            }
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Error in trackEnd event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
