import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { LavalinkEvent } from "../../../../types";

const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.PlayerStateUpdate,
    execute: async (
        oldPlayer: magmastream.Player | null,
        newPlayer: magmastream.Player | null,
        changeType: any,
        client: discord.Client
    ) => {
        try {
            if (!oldPlayer && !newPlayer) {
                client.logger.debug("[PLAYER_STATE_UPDATE] Both oldPlayer and newPlayer are null, skipping");
                return;
            }

            const player = newPlayer || oldPlayer;
            if (!player || !player.guildId) {
                client.logger.debug("[PLAYER_STATE_UPDATE] No valid player or guild found, skipping");
                return;
            }

            client.logger.debug(`[PLAYER_STATE_UPDATE] Event triggered for guild ${player.guildId}`);

            if (!newPlayer || !newPlayer.playing || newPlayer.paused) {
                client.logger.debug(`[PLAYER_STATE_UPDATE] Skipping update - player not playing or paused`);
                return;
            }

            if (newPlayer && newPlayer.playing && !newPlayer.paused) {
                const now = Date.now();
                const lastUpdate = (newPlayer as any).lastUpdateTime || 0;

                if (now - lastUpdate > 15000 || (changeType?.details?.changeType === "trackChange")) {
                    (newPlayer as any).lastUpdateTime = now;
                    const nowPlayingManager = NowPlayingManager.getInstance(player.guildId, newPlayer, client);
                    if (nowPlayingManager.hasMessage()) {
                        nowPlayingManager.forceUpdate();
                    }
                }
            }
        } catch (error) {
            console.error("[PLAYER_STATE_UPDATE] Error:", error);
            client.logger.error(`[PLAYER_STATE_UPDATE] Error handling state change: ${error}`);
        }
    },
};

export default lavalinkEvent;