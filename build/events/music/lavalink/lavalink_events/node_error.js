"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.NodeError,
    execute: async (node, error, client) => client.logger.error(`[LAVALINK] Node ${node.options.identifier} encountered an error]\n${error}`),
};
exports.default = lavalinkEvent;
