import discord from "discord.js";
import { Player } from "magmastream";
import {
    wait,
    updateMusicGuildChannelDB
} from "../../../../utils/music/music_functions";
import { LavalinkEvent } from '../../../../types';
import MusicGuildModel from "../../../database/schema/music_guild";

/**
 * Creates a queue end notification embed
 * @param client - Discord client instance
 * @returns EmbedBuilder instance
 */
const createQueueEndEmbed = (client: discord.Client): discord.EmbedBuilder => {
    return new discord.EmbedBuilder()
        .setDescription("🎵 Played all music in queue")
        .setColor(client.config.content.embed.no_music_playing.color as discord.ColorResolvable);
};

/**
 * Handles player cleanup after queue end
 * @param player - Music player instance
 * @param status247 - Whether 24/7 mode is enabled
 */
const handlePlayerCleanup = async (player: Player, status247: boolean): Promise<void> => {
    if (status247) return;

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
    execute: async (player: Player, client: discord.Client): Promise<void> => {
        if (!player?.textChannel || !client?.channels) return;

        try {
            const channel = await client.channels.fetch(player.textChannel) as discord.TextChannel;
            if (!channel?.isTextBased()) return;

            await channel.send({
                embeds: [createQueueEndEmbed(client)]
            });

            const musicGuildData = await MusicGuildModel.findOne({ guildId: player.guild });
            if (!musicGuildData) return;

            await updateMusicGuildChannelDB(client, musicGuildData, player, null, true);
            await handlePlayerCleanup(player, musicGuildData.status247);

        } catch (error) {
            client.logger.error(`Error in queueEnd event: ${error}`);
        }
    }
};

export default lavalinkEvent;