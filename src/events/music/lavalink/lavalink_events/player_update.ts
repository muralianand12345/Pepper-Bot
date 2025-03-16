import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { LavalinkEvent } from "../../../../types";

/**
 * Player state update event handler
 * Triggers when player state changes, including position updates
 */
const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.PlayerStateUpdate,
    execute: async (
        oldPlayer: magmastream.Player | null,
        newPlayer: magmastream.Player | null,
        changeType: any,
        client: discord.Client
    ) => {
        try {
            // Check if players are null
            if (!oldPlayer && !newPlayer) {
                client.logger.debug("[PLAYER_STATE_UPDATE] Both oldPlayer and newPlayer are null, skipping");
                return;
            }

            // Use whichever player is available for logging
            const player = newPlayer || oldPlayer;

            // Guard against null player
            if (!player || !player.guildId) {
                client.logger.debug("[PLAYER_STATE_UPDATE] No valid player or guild found, skipping");
                return;
            }

            client.logger.debug(`[PLAYER_STATE_UPDATE] Event triggered for guild ${player.guildId}`);

            // If we don't have newPlayer or it's not playing, skip update
            if (!newPlayer || !newPlayer.playing || newPlayer.paused) {
                client.logger.debug(`[PLAYER_STATE_UPDATE] Skipping update - player not playing or paused`);
                return;
            }

            // Only handle updates for active players
            if (newPlayer && newPlayer.playing && !newPlayer.paused) {
                // Only update now playing message at reasonable intervals to avoid rate limiting
                // or when position changes significantly
                const now = Date.now();
                const lastUpdate = (newPlayer as any).lastUpdateTime || 0;

                // Update every 15 seconds or if significant position change (e.g., seeking)
                if (now - lastUpdate > 15000 || (changeType?.details?.changeType === "trackChange")) {
                    // Update the last update timestamp
                    (newPlayer as any).lastUpdateTime = now;

                    // Update the now playing message if needed
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