import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import AutoplayManager from "../../../../utils/music/autoplay_manager";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink track end event handler
 * Monitors track ends to manage custom autoplay functionality
 */
const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.TrackEnd,
    execute: async (
        player: magmastream.Player,
        track: magmastream.Track,
        payload: magmastream.TrackEndEvent,
        client: discord.Client
    ) => {
        try {
            if (!player?.guildId) return;

            // Log track end
            client.logger.debug(
                `[LAVALINK] Track ${track.title} ended in guild ${player.guildId} with reason: ${payload.reason}`
            );

            // Check if this is a "finished" event (not skipped, replaced, etc.)
            // Only process autoplay for tracks that finished naturally
            const finishedNaturally = payload.reason === "finished";

            // Check if the queue is nearly empty
            const queueIsNearlyEmpty = player.queue.size < 2;

            // Handle autoplay only if the track finished naturally and the queue is nearly empty
            if (finishedNaturally && queueIsNearlyEmpty) {
                const autoplayManager = AutoplayManager.getInstance(
                    player.guildId,
                    player,
                    client
                );

                // Process the ended track for autoplay if autoplay is enabled
                if (autoplayManager.isEnabled()) {
                    await autoplayManager.processTrack(track);
                }
            }
        } catch (error) {
            client.logger.error(`[LAVALINK] Error in trackEnd event: ${error}`);
        }
    },
};

export default lavalinkEvent;