import https from "https";
import discord from "discord.js";
import { Readable } from "stream";
import timers from "timers/promises";
import magmastream from "magmastream";
import { musicButton } from "./embed_template";
import { createPlaylistEmbed, createTrackEmbed } from "./embed_template";

/**
 * Creates a promise that resolves after the specified milliseconds
 * @param ms - Number of milliseconds to wait
 * @returns Promise that resolves after the specified delay
 */
const wait = async (ms: number): Promise<void> => {
    await timers.setTimeout(ms);
};

/**
 * Formats the queue message for display
 * @param player - Music player instance
 * @returns Formatted queue message string
 */
const formatQueueMessage = (player: magmastream.Player): string => {
    const queueList = player.queue
        .map((track, i) => `**${i + 1}** - [${track.title}](${track.uri})`)
        .slice(0, 5)
        .join("\n");

    const remainingTracks =
        player.queue.length > 5
            ? `And **${player.queue.length - 5}** more tracks...`
            : `In the playlist **${player.queue.length}** tracks...`;

    return `Song queue:\n\n${queueList}\n\n${remainingTracks}`;
};

/**
 * Fetches an audio stream from a given URL
 * @param url - URL of the audio stream
 * @returns Promise resolving to a Readable stream
 * @throws Error if the stream cannot be fetched
 */
const fetchAudioStream = (url: string): Promise<Readable> => {
    return new Promise<Readable>((resolve, reject) => {
        https
            .get(url, { rejectUnauthorized: false }, (response) => {
                if (response.statusCode !== 200) {
                    reject(
                        new Error(
                            `Failed to fetch audio stream: ${response.statusCode}`
                        )
                    );
                    return;
                }
                resolve(response);
            })
            .on("error", (error) => {
                reject(
                    new Error(`Error fetching audio stream: ${error.message}`)
                );
            });
    });
};

/**
 * Processes search results and manages music playback
 * @param {magmastream.SearchResult} res - Music search results
 * @param {magmastream.Player} player - Music player instance
 * @param {discord.ChatInputCommandInteraction} interaction - Command interaction
 * @param {any} client - Discord client instance
 */
const handleSearchResult = async (
    res: magmastream.SearchResult,
    player: magmastream.Player,
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client
): Promise<void> => {
    const searchQuery = interaction.options.getString("song", true);

    switch (res.loadType) {
        case "empty": {
            if (!player.queue.current) player.destroy();
            await interaction.followUp({
                embeds: [
                    new discord.EmbedBuilder()
                        .setColor("Red")
                        .setTitle("🤔 Hmm...")
                        .setDescription("No results found"),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
            break;
        }

        case "track":
        case "search": {
            const track = res.tracks[0];
            player.queue.add(track);
            if (!player.playing && !player.paused && !player.queue.size)
                player.play();

            await interaction.followUp({
                embeds: [createTrackEmbed(track, client)],
                components: [musicButton],
            });
            break;
        }

        case "playlist": {
            if (!res.playlist) break;
            res.playlist.tracks.forEach((track) => player.queue.add(track));
            if (!player.playing && !player.paused && !player.queue.totalSize)
                player.play();

            await interaction.followUp({
                embeds: [
                    createPlaylistEmbed(
                        res.playlist,
                        searchQuery,
                        interaction.user.tag,
                        client
                    ),
                ],
            });
            break;
        }
    }
};

/**
 * Sends temporary message that auto-deletes after specified time
 * @param channel - Text channel to send message
 * @param embed - Embed message to send
 * @param duration - Duration in ms before deletion
 */
const sendTempMessage = async (
    channel: discord.TextChannel,
    embed: discord.EmbedBuilder,
    duration: number = 10000
): Promise<void> => {
    const message = await channel.send({ embeds: [embed] });
    setTimeout(() => message.delete().catch(() => {}), duration);
};

export {
    wait,
    fetchAudioStream,
    handleSearchResult,
    sendTempMessage,
    formatQueueMessage,
};
