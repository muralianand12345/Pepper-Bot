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
            if (!player) {
                client.logger.debug("[PLAYER_STATE_UPDATE] No valid player found, skipping");
                return;
            }

            client.logger.debug(`[PLAYER_STATE_UPDATE] Event triggered for guild ${player.guildId}`);

            // If we don't have newPlayer or it's not playing, skip update
            if (!newPlayer || !newPlayer.playing || newPlayer.paused) {
                client.logger.debug(`[PLAYER_STATE_UPDATE] Skipping update - player not playing or paused`);
                return;
            }

            // Check if the update includes position changes (timeUpdate event)
            const isPositionUpdate =
                changeType?.changeType === "playerUpdate" ||
                (changeType?.details?.changeType === "timeUpdate") ||
                (changeType?.details?.changeType === "trackChange");

            if (isPositionUpdate) {
                // Store the last update time if it doesn't exist
                if (!(newPlayer as any).lastStateUpdate) {
                    (newPlayer as any).lastStateUpdate = Date.now();
                }

                // Calculate time since last update
                const timeSinceLastUpdate = Date.now() - ((newPlayer as any).lastStateUpdate || 0);
                const regularUpdateNeeded = timeSinceLastUpdate > 15000; // 15 seconds

                // Check for significant position change if we have old and new positions
                let significantChange = false;
                if (changeType?.details?.previousTime && changeType?.details?.currentTime) {
                    const positionDifference = Math.abs(
                        changeType.details.currentTime - changeType.details.previousTime
                    );
                    significantChange = positionDifference > 3000; // 3 seconds threshold
                }

                // Log detailed debugging information
                client.logger.debug(
                    `[PLAYER_STATE_UPDATE] Time since update: ${timeSinceLastUpdate}ms, ` +
                    `Significant change: ${significantChange}, Regular update needed: ${regularUpdateNeeded}`
                );

                // Update the timestamp of the last player update
                (newPlayer as any).lastStateUpdate = Date.now();

                // Check if we should update the now playing message
                if (significantChange || regularUpdateNeeded || changeType?.details?.changeType === "trackChange") {
                    client.logger.debug(`[PLAYER_STATE_UPDATE] Forcing now playing update`);
                    const nowPlayingManager = NowPlayingManager.getInstance(newPlayer.guildId, newPlayer, client);
                    nowPlayingManager.forceUpdate();
                }
            } else {
                // Log other state updates for debugging
                client.logger.debug(`[PLAYER_STATE_UPDATE] State update, not position related: ${JSON.stringify(changeType?.changeType || 'unknown')
                    }`);
            }
        } catch (error) {
            console.error("[PLAYER_STATE_UPDATE] Error:", error);
            client.logger.error(`[PLAYER_STATE_UPDATE] Error handling state change: ${error}`);
        }
    },
};

export default lavalinkEvent;