import discord from "discord.js";
import { Player, Track, TrackEndEvent } from "magmastream";
import { wait } from "../../../../utils/music/music_functions";
import { MusicResponseHandler } from "../../../../utils/music/embed_template";
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
 * @param status247 - Whether 24/7 mode is enabled
 */
const handlePlayerCleanup = async (player: Player): Promise<void> => {
    // Wait 5 minutes before destroying the player
    const CLEANUP_DELAY = 300000; // 5 minutes in milliseconds
    await wait(CLEANUP_DELAY);
    player.destroy();
};

/**
 * Lavalink queue end event handler
 * Handles the event when all music in the queue has finished playing
 */
const lavalinkEvent: LavalinkEvent = {
    name: "queueEnd",
    execute: async (
        player: Player,
        track: Track,
        payload: TrackEndEvent,
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

            await handlePlayerCleanup(player);
        } catch (error) {
            client.logger.error(`Error in queueEnd event: ${error}`);
        }
    },
};

export default lavalinkEvent;
