"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.Debug,
    execute: async (info, client) => client.logger.debug(`[LAVALINK] ${info}`),
};
exports.default = lavalinkEvent;
