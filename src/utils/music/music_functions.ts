import https from "https";
import discord from "discord.js";
import { Readable } from "stream";
import timers from "timers/promises";
import magmastream from "magmastream";
import { shouldSendMessageInChannel } from "../music_channel_utility";
import { createPlaylistEmbed, createTrackEmbed, musicButton } from "./embed_template";

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
 * Command context that can be either an interaction or a message
 */
type CommandContext =
    | { type: 'interaction'; interaction: discord.ChatInputCommandInteraction }
    | { type: 'message'; message: discord.Message };

// Type guard functions to check context type
const isInteractionContext = (context: CommandContext): context is { type: 'interaction'; interaction: discord.ChatInputCommandInteraction } => {
    return context.type === 'interaction';
};

const isMessageContext = (context: CommandContext): context is { type: 'message'; message: discord.Message } => {
    return context.type === 'message';
};

/**
 * Gets the guild ID from the context
 * @param context Command context (interaction or message)
 * @returns Guild ID or undefined if not in a guild
 */
const getGuildId = (context: CommandContext): string | undefined => {
    if (isInteractionContext(context)) {
        return context.interaction.guildId || undefined;
    } else if (isMessageContext(context)) {
        return context.message.guild?.id;
    }
    return undefined;
};

/**
 * Gets the channel ID from the context
 * @param context Command context (interaction or message)
 * @returns Channel ID or undefined if not in a channel
 */
const getChannelId = (context: CommandContext): string | undefined => {
    if (isInteractionContext(context)) {
        return context.interaction.channelId;
    } else if (isMessageContext(context)) {
        return context.message.channel.id;
    }
    return undefined;
};

/**
 * Processes search results and manages music playback
 * @param {magmastream.SearchResult} res - Music search results
 * @param {magmastream.Player} player - Music player instance
 * @param {CommandContext} context - Command context (interaction or message)
 * @param {discord.Client} client - Discord client instance
 */
const handleSearchResult = async (
    res: magmastream.SearchResult,
    player: magmastream.Player,
    context: CommandContext,
    client: discord.Client
): Promise<void> => {
    // Get channel ID and guild ID for checking if this is the music panel channel
    const channelId = getChannelId(context);
    const guildId = getGuildId(context);

    // Check if we should send messages in this channel
    let shouldSendMessages = true;
    if (channelId && guildId) {
        shouldSendMessages = await shouldSendMessageInChannel(channelId, guildId, client);
    }

    // Helper to handle replies based on context type
    const reply = async (options: {
        embeds: discord.EmbedBuilder[],
        components?: discord.ActionRowBuilder<discord.ButtonBuilder>[],
        flags?: discord.MessageFlags
    }) => {
        // If we shouldn't send messages in this channel, log it and return
        if (!shouldSendMessages) {
            client.logger.debug(`[HANDLE_SEARCH] Skipping message in music channel ${channelId}`);
            return null;
        }

        if (isInteractionContext(context)) {
            // For interactions, we use followUp
            return await context.interaction.followUp({
                embeds: options.embeds,
                components: options.components,
                ephemeral: options.flags ? (options.flags === discord.MessageFlags.Ephemeral) : false
            });
        } else if (isMessageContext(context)) {
            // For messages, we send to the channel
            // Ensure the channel is a text-based channel
            const chan = context.message.channel as discord.TextChannel;
            if (chan.isTextBased()) {
                return await chan.send({
                    embeds: options.embeds,
                    components: options.components
                });
            }
        }
        return null;
    };

    // Get search query based on context
    const searchQuery = isInteractionContext(context)
        ? context.interaction.options.getString("song", true)
        : context.message.content.trim();

    switch (res.loadType) {
        case "empty": {
            if (!player.queue.current) player.destroy();
            await reply({
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

            await reply({
                embeds: [createTrackEmbed(track, client, player.queue.size)],
                components: [musicButton],
            });
            break;
        }

        case "playlist": {
            if (!res.playlist) break;
            res.playlist.tracks.forEach((track) => {
                player.queue.add(track);
            });

            if (
                !player.playing &&
                !player.paused &&
                player.queue.totalSize === res.playlist.tracks.length
            ) {
                player.play();
            }

            // Get user tag based on context
            const userTag = isInteractionContext(context)
                ? context.interaction.user.tag
                : context.message.author.tag;

            await reply({
                embeds: [
                    createPlaylistEmbed(
                        res.playlist,
                        searchQuery,
                        userTag,
                        client
                    ),
                ],
                components: [musicButton],
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
    // Ensure the channel is text-based before sending
    if (!channel.isTextBased()) {
        throw new Error("Channel is not text-based");
    }

    // Send the message with error handling
    const message = await channel.send({ embeds: [embed] }).catch((error: Error | any) => {
        if (error.code === 50001) {
            console.error("Unable to send message: Missing access");
            return null;
        }
        console.error(`Error sending message: ${error.message}`);
        return null;
    });

    if (!message) return;

    // Set up auto-deletion after the specified duration
    setTimeout(() => {
        message.delete().catch((deleteError: Error | any) => {
            // Silently fail if message was already deleted
            if (deleteError.code !== 10008) {
                console.error(`Error deleting message: ${deleteError.message}`);
            }
        });
    }, duration);
};

/**
 * Class to manage queue pagination
 * @class QueuePagination
 * @property {number} currentPage - Current page number
 * @property {any[]} queueList - List of items to paginate
 * @property {number} itemsPerPage - Number of items per page
 */
class QueuePagination {
    private currentPage: number = 0;
    private queueList: any[];
    public readonly itemsPerPage: number = 10;

    constructor(queue: any[]) {
        this.queueList = queue;
    }

    getCurrentPageItems = () => {
        const startIdx = this.currentPage * this.itemsPerPage;
        const endIdx = startIdx + this.itemsPerPage;
        return this.queueList.slice(startIdx, endIdx);
    };

    getMaxPages = () => Math.ceil(this.queueList.length / this.itemsPerPage);

    getRemainingItems = () =>
        Math.max(
            this.queueList.length - (this.currentPage + 1) * this.itemsPerPage,
            0
        );

    nextPage = () => {
        if (this.currentPage < this.getMaxPages() - 1) {
            this.currentPage++;
            return true;
        }
        return false;
    };

    previousPage = () => {
        if (this.currentPage > 0) {
            this.currentPage--;
            return true;
        }
        return false;
    };

    getCurrentPage = () => this.currentPage;
}

export {
    wait,
    fetchAudioStream,
    handleSearchResult,
    sendTempMessage,
    formatQueueMessage,
    QueuePagination,
};