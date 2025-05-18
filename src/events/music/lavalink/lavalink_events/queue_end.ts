import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { wait } from "../../../../utils/music/music_functions";
import music_guild from "../../../database/schema/music_guild";
import AutoplayManager from "../../../../utils/music/autoplay_manager";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { shouldSendMessageInChannel } from "../../../../utils/music_channel_utility";
import { MusicResponseHandler, MusicChannelManager } from "../../../../utils/music/embed_template";
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
    if (shouldAutoplayKeepAlive(player, guildId, client)) {
        client.logger.info(`[QUEUE_END] Autoplay is enabled, keeping player alive for guild ${guildId}`);
        return;
    }

    const CLEANUP_DELAY = 300000;
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

    if (currentPlayer.cleanupScheduledAt !== scheduledAt) {
        client.logger.debug(`[QUEUE_END] Cleanup task for guild ${guildId} has been superseded, skipping`);
        return;
    }

    if (currentPlayer.playing || currentPlayer.queue.current) {
        client.logger.debug(`[QUEUE_END] Player for guild ${guildId} is active again, skipping cleanup`);
        return;
    }

    NowPlayingManager.removeInstance(guildId);
    AutoplayManager.removeInstance(guildId);

    client.logger.info(`[QUEUE_END] Performing cleanup for guild ${guildId} after ${CLEANUP_DELAY_MINS} minutes of inactivity`);

    player.destroy();
};

const resetMusicChannelEmbed = async (
    guildId: string,
    client: discord.Client
): Promise<void> => {
    try {
        const guildData = await music_guild.findOne({ guildId });
        if (!guildData?.songChannelId || !guildData?.musicPannelId) return;

        const channel = await client.channels.fetch(guildData.songChannelId);
        if (!channel || !channel.isTextBased()) return;

        const musicChannelManager = new MusicChannelManager(client);
        await musicChannelManager.resetEmbed(guildData.musicPannelId, channel as discord.TextChannel);

        client.logger.info(`[QUEUE_END] Reset music channel embed in guild ${guildId}`);
    } catch (error) {
        client.logger.error(`[QUEUE_END] Error resetting music channel embed: ${error}`);
    }
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

            const autoplayManager = AutoplayManager.getInstance(
                player.guildId,
                player,
                client
            );

            if (autoplayManager.isEnabled() && track) {
                const processed = await autoplayManager.processTrack(track);
                if (processed) {
                    client.logger.info(`[QUEUE_END] Autoplay added tracks for guild ${player.guildId}`);
                    return;
                }
            }

            const shouldSendMessage = await shouldSendMessageInChannel(
                channel.id,
                player.guildId,
                client
            );

            if (shouldSendMessage) {
                await channel.send({
                    embeds: [createQueueEndEmbed(client)],
                });
            } else {
                client.logger.debug(`[QUEUE_END] Skipping queue end message in music channel ${channel.id}`);
            }

            await resetMusicChannelEmbed(player.guildId, client);
            await handlePlayerCleanup(player, player.guildId, client);
        } catch (error) {
            client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
        }
    },
};

export default lavalinkEvent;