import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";

import { LavalinkEvent } from "../../../../types";
import { wait, Autoplay, NowPlayingManager, MusicResponseHandler } from "../../../../core/music";


const createQueueEndEmbed = (client: discord.Client): discord.EmbedBuilder => {
    return new MusicResponseHandler(client).createInfoEmbed("🎵 Played all music in queue");
};

const shouldAutoplayKeepAlive = (player: magmastream.Player, guildId: string, client: discord.Client): boolean => {
    try {
        const autoplayManager = Autoplay.getInstance(guildId, player, client);
        return autoplayManager.isEnabled();
    } catch (error) {
        client.logger.error(`[QUEUE_END] Error checking autoplay status: ${error}`);
        return false;
    }
};

const handlePlayerCleanup = async (player: magmastream.Player, guildId: string, client: discord.Client): Promise<void> => {
    if (shouldAutoplayKeepAlive(player, guildId, client)) return client.logger.info(`[QUEUE_END] Autoplay is enabled, keeping player alive for guild ${guildId}`);
    const CLEANUP_DELAY = 300000;
    const CLEANUP_DELAY_MINS = CLEANUP_DELAY / 60000;

    const scheduledAt = Date.now();
    player.cleanupScheduledAt = scheduledAt;

    client.logger.info(`[QUEUE_END] Scheduled cleanup for guild ${guildId} in ${CLEANUP_DELAY_MINS} minutes`);

    await wait(CLEANUP_DELAY);

    const currentPlayer = client.manager.get(guildId);
    if (!currentPlayer) return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} already destroyed, skipping cleanup`);
    if (currentPlayer.cleanupScheduledAt !== scheduledAt) return client.logger.debug(`[QUEUE_END] Cleanup task for guild ${guildId} has been superseded, skipping`);
    if (currentPlayer.playing || currentPlayer.queue.current) return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} is active again, skipping cleanup`);

    NowPlayingManager.removeInstance(guildId);
    Autoplay.removeInstance(guildId);

    client.logger.info(`[QUEUE_END] Performing cleanup for guild ${guildId} after ${CLEANUP_DELAY_MINS} minutes of inactivity`);

    player.destroy();
};

const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.QueueEnd,
    execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackEndEvent, client: discord.Client): Promise<void> => {
        if (!player?.textChannelId || !client?.channels) return;

        try {
            const channel = (await client.channels.fetch(player.textChannelId)) as discord.TextChannel;
            if (!channel?.isTextBased()) return;

            const autoplayManager = Autoplay.getInstance(player.guildId, player, client);
            if (autoplayManager.isEnabled() && track) {
                const processed = await autoplayManager.processTrack(track);
                if (processed) return client.logger.info(`[QUEUE_END] Autoplay added tracks for guild ${player.guildId}`);
            };

            try {
                const queueEndEmbed = createQueueEndEmbed(client);
                await channel.send({ embeds: [queueEndEmbed] });

                client.logger.debug(`[QUEUE_END] Queue end message sent with disabled buttons for guild ${player.guildId}`);
            } catch (messageError) {
                client.logger.error(`[QUEUE_END] Failed to send queue end message: ${messageError}`);
            }

            await handlePlayerCleanup(player, player.guildId, client);
        } catch (error) {
            client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
        }
    },
};

export default lavalinkEvent;