import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { wait } from "../../../../utils/music/music_functions";
import { MusicResponseHandler } from "../../../../utils/music/embed_template";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { LavalinkEvent } from "../../../../types";

/**
 * Creates a queue end notification embed
 * @param client - Discord client instance
 * @returns EmbedBuilder instance
 */
const createQueueEndEmbed = (client: discord.Client): discord.EmbedBuilder => {
    return new MusicResponseHandler(client).createInfoEmbed(
        "🎵 Played all music in queue"
    );
};

/**
 * Handles player cleanup after queue end
 * @param player - Music player instance
 * @param guildId - Guild ID for the player
 * @param client - Discord client instance
 */
const handlePlayerCleanup = async (
    player: magmastream.Player,
    guildId: string,
    client: discord.Client
): Promise<void> => {
    // Wait 5 minutes before destroying the player
    const CLEANUP_DELAY = 300000; // 5 minutes in milliseconds
    const CLEANUP_DELAY_MINS = CLEANUP_DELAY / 60000;

    const scheduledAt = Date.now();
    player.cleanupScheduledAt = scheduledAt;

    client.logger.info(`[QUEUE_END] Scheduled cleanup for guild ${guildId} in ${CLEANUP_DELAY_MINS} minutes`);

    await wait(CLEANUP_DELAY);

    const currentPlayer = client.manager.get(guildId);
    if (!currentPlayer) {
        client.logger.debug(`[QUEUE_END] Player for guild ${guildId} already destroyed, skipping cleanup`);
        return;
    }

    // Check if this cleanup task is still valid (not superseded by a newer one)
    if (currentPlayer.cleanupScheduledAt !== scheduledAt) {
        client.logger.debug(`[QUEUE_END] Cleanup task for guild ${guildId} has been superseded, skipping`);
        return;
    }

    // Check if player is still inactive (no tracks playing)
    if (currentPlayer.playing || currentPlayer.queue.current) {
        client.logger.debug(`[QUEUE_END] Player for guild ${guildId} is active again, skipping cleanup`);
        return;
    }

    // Clean up the now playing manager
    NowPlayingManager.removeInstance(guildId);

    client.logger.info(`[QUEUE_END] Performing cleanup for guild ${guildId} after ${CLEANUP_DELAY_MINS} minutes of inactivity`);

    // Destroy the player
    player.destroy();
};

/**
 * Lavalink queue end event handler
 * Handles the event when all music in the queue has finished playing
 */
const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.QueueEnd,
    execute: async (
        player: magmastream.Player,
        track: magmastream.Track,
        payload: magmastream.TrackEndEvent,
        client: discord.Client
    ): Promise<void> => {
        if (!player?.textChannelId || !client?.channels) return;

        try {
            const channel = (await client.channels.fetch(
                player.textChannelId
            )) as discord.TextChannel;
            if (!channel?.isTextBased()) return;

            await channel.send({
                embeds: [createQueueEndEmbed(client)],
            });

            await handlePlayerCleanup(player, player.guildId, client);
        } catch (error) {
            client.logger.error(`Error in queueEnd event: ${error}`);
        }
    },
};

export default lavalinkEvent;