import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { wait, sendTempMessageContent } from "../../../../utils/music/music_functions";
import { MusicResponseHandler } from "../../../../utils/music/embed_template";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import AutoplayManager from "../../../../utils/music/autoplay_manager";
import MusicPanelManager from "../../../../utils/music/panel_manager";
import music_guild from "../../../../events/database/schema/music_guild";
import { LavalinkEvent } from "../../../../types";

const createQueueEndEmbed = (client: discord.Client): discord.EmbedBuilder => {
    return new MusicResponseHandler(client).createInfoEmbed(
        "🎵 Played all music in queue"
    );
};

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

    // Reset the music panel to default
    const panelManager = MusicPanelManager.getInstance(guildId, client);
    await panelManager.resetToDefault();

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

            // Check if this is the song channel
            const guildData = await music_guild.findOne({ guildId: player.guildId });
            const isSongChannel = guildData?.songChannelId === channel.id;

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

            // When sending the queue end message:
            if (isSongChannel) {
                // If it's the song channel, make it temporary
                await sendTempMessageContent(
                    channel,
                    { embeds: [createQueueEndEmbed(client)] },
                    5000 // 5 seconds
                );
            } else {
                // Regular channel - permanent message
                await channel.send({
                    embeds: [createQueueEndEmbed(client)],
                });
            }

            // Schedule player cleanup if needed
            await handlePlayerCleanup(player, player.guildId, client);
        } catch (error) {
            client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
        }
    },
};

export default lavalinkEvent;