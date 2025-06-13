"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const music_1 = require("../../../../core/music");
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.PlayerStateUpdate,
    execute: async (oldPlayer, newPlayer, changeType, client) => {
        try {
            if (!oldPlayer && !newPlayer)
                return client.logger.debug('[PLAYER_STATE_UPDATE] Both oldPlayer and newPlayer are null, skipping');
            const player = newPlayer || oldPlayer;
            if (!player || !player.guildId)
                return client.logger.debug('[PLAYER_STATE_UPDATE] No valid player or guild found, skipping');
            client.logger.debug(`[PLAYER_STATE_UPDATE] Event triggered for guild ${player.guildId}`);
            if (!newPlayer || !newPlayer.playing || newPlayer.paused)
                return client.logger.debug(`[PLAYER_STATE_UPDATE] Skipping update - player not playing or paused`);
            if (newPlayer && newPlayer.playing && !newPlayer.paused) {
                const now = Date.now();
                const lastUpdate = newPlayer.lastUpdateTime || 0;
                if (now - lastUpdate > 15000 || changeType?.details?.changeType === 'trackChange') {
                    newPlayer.lastUpdateTime = now;
                    const nowPlayingManager = music_1.NowPlayingManager.getInstance(player.guildId, newPlayer, client);
                    if (nowPlayingManager.hasMessage())
                        nowPlayingManager.forceUpdate();
                }
            }
        }
        catch (error) {
            client.logger.error(`[PLAYER_STATE_UPDATE] Error handling state change: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
