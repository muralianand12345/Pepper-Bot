"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.PlayerCreate,
    execute: async (player, client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild)
            return;
        client.logger.info(`[LAVALINK] Player for guild ${guild.name} (${guild.id}) created using Node ${player.node.options.identifier} (${player.node.options.host}:${player.node.options.port || ""})`);
    },
};
exports.default = lavalinkEvent;
