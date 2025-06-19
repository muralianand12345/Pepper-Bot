"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.NodeReconnect,
    execute: async (node, client) => client.logger.warn(`[LAVALINK] Node ${node.options.identifier} reconnecting...`),
};
exports.default = lavalinkEvent;
