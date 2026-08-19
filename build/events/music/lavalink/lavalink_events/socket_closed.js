"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const RECOVERABLE_CLOSE_CODES = [4006, 4009, 4014];
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.SocketClosed,
    execute: async (player, payload, client) => {
        if (!player?.guildId)
            return;
        const detail = `code ${payload?.code} (${payload?.reason || 'no reason'}), byRemote: ${payload?.byRemote ?? 'unknown'}`;
        const message = `[LAVALINK] Voice websocket closed for guild ${player.guildId} on node ${player.node.options.identifier}: ${detail}`;
        if (RECOVERABLE_CLOSE_CODES.includes(payload?.code))
            return client.logger.warn(`${message} - playback will stay silent until the player reconnects`);
        client.logger.warn(message);
    },
};
exports.default = lavalinkEvent;
