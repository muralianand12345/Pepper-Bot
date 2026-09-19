"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const music_1 = require("../../../../core/music");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.PlayerRestored,
    execute: async (player, node, client) => {
        client.logger.success(`[LAVALINK] Player for guild ${player.guildId} restored on node ${node.options.identifier}.`);
        try {
            if ((await player.queue.getCurrent()) && !music_1.ActivityCheckManager.hasInstance(player.guildId))
                music_1.ActivityCheckManager.getInstance(player.guildId, player, client);
            if ((0, music_1.countListeners)(client, player.voiceChannelId) === 0)
                await (0, music_1.handleEmptyVoiceChannel)(player, client);
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Failed to re-arm inactivity checks for restored player in guild ${player.guildId}: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
