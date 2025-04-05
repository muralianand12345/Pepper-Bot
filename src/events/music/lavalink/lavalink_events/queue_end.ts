import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { wait } from "../../../../utils/music/music_functions";
import { MusicResponseHandler, MusicChannelManager } from "../../../../utils/music/embed_template";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import AutoplayManager from "../../../../utils/music/autoplay_manager";
import music_guild from "../../../database/schema/music_guild";
import { shouldSendMessageInChannel } from "../../../../utils/music_channel_utility";
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
 * Checks if autoplay should keep the player alive
 * @param player - Music player instance
 * @param guildId - Guild ID for the player
 * @param client - Discord client instance
 * @returns Whether autoplay is enabled and active
 */
const shouldAutoplayKeepAlive = (
    player: magmastream.Player,
    guildId: string,
    client: discord.Client
): boolean => {
    try {
        const autoplayManager = AutoplayManager.getInstance(
            guildId,
            player,
            client
        );
        return autoplayManager.isEnabled();
    } catch (error) {
        client.logger.error(`[QUEUE_END] Error checking autoplay status: ${error}`);
        return false;
    }
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
    // Check if autoplay is enabled and should keep the player alive
    if (shouldAutoplayKeepAlive(player, guildId, client)) {
        client.logger.info(`[QUEUE_END] Autoplay is enabled, keeping player alive for guild ${guildId}`);
        // Don't schedule cleanup when autoplay is enabled
        return;
    }

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

    // Clean up the autoplay manager
    AutoplayManager.removeInstance(guildId);

    client.logger.info(`[QUEUE_END] Performing cleanup for guild ${guildId} after ${CLEANUP_DELAY_MINS} minutes of inactivity`);

    // Destroy the player
    player.destroy();
};

/**
 * Resets the music channel embed if it exists
 * @param guildId - Guild ID for the player
 * @param client - Discord client instance
 */
const resetMusicChannelEmbed = async (
    guildId: string,
    client: discord.Client
): Promise<void> => {
    try {
        // Get guild data to check for music channel and panel message
        const guildData = await music_guild.findOne({ guildId });

        if (!guildData?.songChannelId || !guildData?.musicPannelId) return;

        // Get the channel
        const channel = await client.channels.fetch(guildData.songChannelId);
        if (!channel || !channel.isTextBased()) return;

        // Use MusicChannelManager to reset the embed
        const musicChannelManager = new MusicChannelManager(client);
        await musicChannelManager.resetEmbed(guildData.musicPannelId, channel as discord.TextChannel);

        client.logger.info(`[QUEUE_END] Reset music channel embed in guild ${guildId}`);
    } catch (error) {
        client.logger.error(`[QUEUE_END] Error resetting music channel embed: ${error}`);
    }
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

            // Get autoplay manager
            const autoplayManager = AutoplayManager.getInstance(
                player.guildId,
                player,
                client
            );

            // Process the track for autoplay if enabled
            if (autoplayManager.isEnabled() && track) {
                const processed = await autoplayManager.processTrack(track);

                // If autoplay successfully added tracks, don't send queue end message
                if (processed) {
                    client.logger.info(`[QUEUE_END] Autoplay added tracks for guild ${player.guildId}`);
                    return;
                }
            }

            // Check if we should send messages in this channel
            const shouldSendMessage = await shouldSendMessageInChannel(
                channel.id,
                player.guildId,
                client
            );

            // Send queue end message if autoplay didn't add tracks or is disabled
            // AND if we should send messages in this channel
            if (shouldSendMessage) {
                await channel.send({
                    embeds: [createQueueEndEmbed(client)],
                });
            } else {
                client.logger.debug(`[QUEUE_END] Skipping queue end message in music channel ${channel.id}`);
            }

            // Reset the music channel embed
            await resetMusicChannelEmbed(player.guildId, client);

            // Schedule player cleanup if needed
            await handlePlayerCleanup(player, player.guildId, client);
        } catch (error) {
            client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
        }
    },
};

export default lavalinkEvent;