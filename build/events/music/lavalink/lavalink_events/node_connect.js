"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.NodeConnect,
    execute: async (node, client) => client.logger.success(`[LAVALINK] Node ${node.options.identifier} connected`),
};
exports.default = lavalinkEvent;
