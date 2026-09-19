"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const music_1 = require("../../../../core/music");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.PlayerDisconnect,
    execute: async (player, oldChannelId, client) => {
        if (player.state !== magmastream_1.StateTypes.Connected)
            return;
        client.logger.info(`[PLAYER_DISCONNECT] Bot was disconnected from voice channel ${oldChannelId} in guild ${player.guildId}, destroying player`);
        await player.destroy();
        if (oldChannelId)
            await new music_1.VoiceChannelStatus(client).clear(oldChannelId);
    },
};
exports.default = lavalinkEvent;
