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
    await wait(CLEANUP_DELAY);

    // Clean up the now playing manager
    NowPlayingManager.removeInstance(guildId);

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