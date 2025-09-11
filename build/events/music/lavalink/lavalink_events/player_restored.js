"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.PlayerRestored,
    execute: async (player, node, client) => client.logger.success(`[LAVALINK] Player for guild ${player.guildId} restored on node ${node.options.identifier}.`),
};
exports.default = lavalinkEvent;
