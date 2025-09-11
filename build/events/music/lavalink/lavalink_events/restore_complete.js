"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.RestoreComplete,
    execute: async (node, client) => client.logger.success(`[LAVALINK] Restore complete on node ${node.options.identifier}.`),
};
exports.default = lavalinkEvent;
