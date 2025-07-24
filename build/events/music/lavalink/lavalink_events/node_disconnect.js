"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.NodeDisconnect,
    execute: async (node, reason, client) => client.logger.warn(`[LAVALINK] Node ${node.options.identifier} disconnected\nCode: ${reason.code}\nReason: ${reason.reason}`),
};
exports.default = lavalinkEvent;
