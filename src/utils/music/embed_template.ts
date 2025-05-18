import discord from "discord.js";
import magmastream from "magmastream";
import Formatter from "../format";
import { IConfig } from "../../types";

const getTrackProgress = (position: number, duration: number): {
    displayPosition: number;
    percentage: number;
    formattedPosition: string;
    formattedDuration: string;
} => {
    const normalizedPosition = Math.min(position, duration);
    const percentage = normalizedPosition / duration;
    const formattedPosition = Formatter.msToTime(normalizedPosition);
    const formattedDuration = Formatter.msToTime(duration);

    return {
        displayPosition: normalizedPosition,
        percentage,
        formattedPosition,
        formattedDuration
    };
};

/**
 * Creates a modern Discord-style embed for currently playing music
 * @param client Discord client with configuration
 * @param track Currently playing track
 * @param player Optional player instance for progress info
 * @returns Promise<EmbedBuilder>
 */
const musicEmbed = async (
    client: discord.Client & { config: IConfig },
    track: magmastream.Track,
    player?: magmastream.Player
) => {
    const trackImg = track.thumbnail || track.artworkUrl || client.config.music.image;

    const trackTitle = Formatter.truncateText(track.title, 60);
    const trackAuthor = track.author || "Unknown";
    const trackUri = track.uri || "https://google.com"
    const defaultColor: discord.ColorResolvable = "#2b2d31";
    let progressText = "";

    if (player && player.queue && player.queue.current) {
        try {
            const position = Math.max(0, player.position);
            const duration = track.duration || 0;
            const progress = getTrackProgress(position, duration);
            const length = 15;
            const filledBlocks = Math.floor(progress.percentage * length);
            const progressBar = "▬".repeat(filledBlocks) + "●" + "▬".repeat(Math.max(0, length - filledBlocks - 1));
            
            progressText = `${progressBar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``;
        } catch (error) {
            progressText = "";
        }
    }

    const embed = new discord.EmbedBuilder()
        .setColor(
            (client.config.content.embed.color.default ??
                defaultColor) as discord.ColorResolvable
        )
        .setTitle(`Now Playing`)
        .setDescription(`**${Formatter.hyperlink(trackTitle, trackUri)}**\nby **${trackAuthor}**`)
        .setThumbnail(trackImg);

    if (progressText) {
        embed.addFields([{
            name: "Progress",
            value: progressText,
            inline: false
        }]);
    }

    embed.setFooter({
        text: `${track.sourceName || 'Unknown'} • ${track.requester?.tag || 'Unknown'}`,
        iconURL: client.user?.displayAvatarURL()
    })
        .setTimestamp();

    return embed;
};

/**
 * Creates a modern Discord-style embed for tracks added to queue
 * @param {magmastream.Track} track - Music track information
 * @param {any} client - Discord client instance
 * @param {number | null} [position] - Optional position in queue (null to hide position)
 * @returns {discord.EmbedBuilder} Formatted embed for track
 */
const createTrackEmbed = (
    track: magmastream.Track,
    client: discord.Client,
    position?: number | null
): discord.EmbedBuilder => {
    const title = Formatter.truncateText(track.title, 60);
    const url = track.uri || "https://google.com";
    const author = track.author || "Unknown";
    const duration = track.isStream ? "LIVE" : Formatter.msToTime(track.duration);

    let queueInfo = "";
    if (position === 0) {
        queueInfo = "Playing next";
    } else if (position !== null && position !== undefined) {
        queueInfo = `Position #${position + 1}`;
    }

    const fields = [
        {
            name: "Duration",
            value: duration,
            inline: true,
        },
        {
            name: "Source",
            value: track.sourceName || "Unknown",
            inline: true,
        },
        {
            name: "Requested by",
            value: track.requester?.tag || "Unknown",
            inline: true,
        }
    ];

    if (queueInfo) {
        fields.push({
            name: "Queue Info",
            value: queueInfo,
            inline: false,
        });
    }

    return new discord.EmbedBuilder()
        .setColor("#5865f2")
        .setTitle(`Track Added to Queue`)
        .setDescription(`**${Formatter.hyperlink(title, url)}**\nby ${author}`)
        .setThumbnail(track.artworkUrl || track.thumbnail || null)
        .addFields(fields)
        .setFooter({
            text: client.user?.username || "Music Bot",
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();
};

/**
 * Creates a modern Discord-style embed for playlists added to queue
 * @param {magmastream.PlaylistData} playlist - Playlist information
 * @param {string} query - Original search query
 * @param {string} requester - User who requested the playlist
 * @param {any} client - Discord client instance
 * @returns {discord.EmbedBuilder} Formatted embed for playlist
 */
const createPlaylistEmbed = (
    playlist: magmastream.PlaylistData,
    query: string,
    requester: string,
    client: discord.Client
): discord.EmbedBuilder => {
    const playlistName = Formatter.truncateText(playlist.name || "Untitled Playlist", 50);
    const trackPreview = playlist.tracks
        .slice(0, 5)
        .map((track, i) => {
            const title = Formatter.truncateText(track.title, 40);
            return `**${i + 1}.** ${title}`;
        })
        .join("\n");
    const moreTracksText = playlist.tracks.length > 5
        ? `\n*...and ${playlist.tracks.length - 5} more tracks*`
        : "";
    const totalDuration = Formatter.msToTime(playlist.duration || 0);
    let avgDuration = "0:00:00";
    if (playlist.tracks.length > 0) {
        const avgMs = Math.floor(playlist.duration / playlist.tracks.length);
        avgDuration = Formatter.msToTime(avgMs);
    }

    return new discord.EmbedBuilder()
        .setColor("#43b581")
        .setTitle("Playlist Added to Queue")
        .setDescription(`**${playlistName}**\n\n**Preview:**\n${trackPreview}${moreTracksText}`)
        .setThumbnail(playlist.tracks[0]?.artworkUrl || playlist.tracks[0]?.thumbnail || null)
        .addFields([
            {
                name: "Tracks",
                value: `${playlist.tracks.length}`,
                inline: true,
            },
            {
                name: "Total Duration",
                value: totalDuration,
                inline: true,
            },
            {
                name: "Avg. Duration",
                value: avgDuration,
                inline: true,
            },
            {
                name: "Added by",
                value: requester || "Unknown",
                inline: false,
            }
        ])
        .setFooter({
            text: `Playlist loaded successfully`,
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();
};

/**
 * Button configuration using icons that match Discord's native style
 */
const buttonConfig = [
    { id: "pause-music", label: "Pause", emoji: "⏸️" },
    { id: "resume-music", label: "Resume", emoji: "▶️" },
    { id: "skip-music", label: "Skip", emoji: "⏭️" },
    { id: "stop-music", label: "Stop", emoji: "⏹️" },
    { id: "loop-music", label: "Loop", emoji: "🔄" },
];

/**
 * Creates a row of music control buttons with modern Discord-style
 * @param disabled Whether the buttons should be disabled
 * @returns ActionRowBuilder with button components
 */
const createMusicButtons = (disabled: boolean) => {
    const row = new discord.ActionRowBuilder<discord.ButtonBuilder>();

    buttonConfig.forEach(({ id, label, emoji }) => {
        row.addComponents(
            new discord.ButtonBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setStyle(discord.ButtonStyle.Secondary)
                .setEmoji(emoji)
                .setDisabled(disabled)
        );
    });

    return row;
};

const disabledMusicButton = createMusicButtons(true);
const musicButton = createMusicButtons(false);

/**
 * Handles music button interaction responses with modern Discord-style
 * @class MusicResponseHandler
 */
class MusicResponseHandler {
    private readonly client: discord.Client;

    constructor(client: discord.Client) {
        this.client = client;
    }

    /**
     * Creates a success embed for music actions
     * @param {string} message - Success message
     * @returns {discord.EmbedBuilder} Configured success embed
     */
    public createSuccessEmbed(message: string): discord.EmbedBuilder {
        return new discord.EmbedBuilder()
            .setColor("#43b581")
            .setDescription(`✓ ${message}`)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            });
    }

    /**
     * Creates an error embed for music actions
     * @param {string} message - Error message
     * @param {boolean} contact_dev - Whether to contact the developer prompt to be included
     * @returns {discord.EmbedBuilder} Configured error embed
     */
    public createErrorEmbed(
        message: string,
        contact_dev: boolean = false
    ): discord.EmbedBuilder {
        const embed = new discord.EmbedBuilder()
            .setColor("#f04747")
            .setDescription(`❌ ${message}`)
            .setFooter({
                text: contact_dev
                    ? "If this issue persists, please use /feedback or contact the developer"
                    : this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            });

        return embed;
    }

    /**
     * Creates an info embed for music actions
     * @param {string} message - Info message
     * @returns {discord.EmbedBuilder} Configured info embed
     */
    public createInfoEmbed(message: string): discord.EmbedBuilder {
        return new discord.EmbedBuilder()
            .setColor("#5865f2")
            .setDescription(`ℹ️ ${message}`)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            });
    }

    /**
     * Creates a warning embed for music actions
     * @param {string} message - Warning message
     * @returns {discord.EmbedBuilder} Configured warning embed
     */
    public createWarningEmbed(message: string): discord.EmbedBuilder {
        return new discord.EmbedBuilder()
            .setColor("#faa61a")
            .setDescription(`⚠️ ${message}`)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            });
    }

    /**
     * Gets support button for error messages
     * @returns {discord.ActionRowBuilder<discord.ButtonBuilder>} Support button component
     */
    public getSupportButton(): discord.ActionRowBuilder<discord.ButtonBuilder> {
        return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
            new discord.ButtonBuilder()
                .setLabel("Support Server")
                .setStyle(discord.ButtonStyle.Link)
                .setURL("https://discord.gg/XzE9hSbsNb")
                .setEmoji("🔧")
        );
    }

    /**
     * Gets music dashboard button
     * @returns {discord.ActionRowBuilder<discord.ButtonBuilder>} Support button component
     */
    public getDashboardButton(guildId: string | null): discord.ActionRowBuilder<discord.ButtonBuilder> {
        return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
            new discord.ButtonBuilder()
                .setLabel("Dashboard")
                .setStyle(discord.ButtonStyle.Link)
                .setURL(this.client.config.music.dashboard_url.replace("<guildId>", guildId || ""))
                .setEmoji("🖥️")
        );
    }
}

/**
 * Manages the music channel embed display and updates
 * Handles initial setup, queue updates, and reset functionality
 */
class MusicChannelManager {
    private readonly client: discord.Client;
    private readonly maxQueueItems: number = 5;

    /**
     * Creates a new MusicChannelManager instance
     * @param client Discord client instance
     */
    constructor(client: discord.Client) {
        this.client = client;
    }

    /**
     * Creates the initial music channel embed
     * @returns Discord embed for the music channel
     */
    public setupMusicChannelEmbed = (): discord.EmbedBuilder => {
        return new discord.EmbedBuilder()
            .setColor('Blurple')
            .setTitle(`${this.client.user?.username} Music Channel`)
            .setDescription("Enter a song name or URL to get started!")
            .setImage(this.client.config.music.image)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            })
            .setTimestamp();
    };

    /**
     * Updates the music channel embed with current queue information
     * @param messageId ID of the message to update
     * @param channel Text channel containing the message
     * @param player The Magmastream player instance
     * @returns Promise resolving to the updated message or null if update failed
     */
    public updateQueueEmbed = async (
        messageId: string,
        channel: discord.TextChannel,
        player: magmastream.Player
    ): Promise<discord.Message | null> => {
        try {
            this.client.logger.debug(`[MUSIC_CHANNEL] Attempting to update embed message ID: ${messageId} in channel: ${channel.name}`);

            const message = await channel.messages.fetch(messageId).catch(error => {
                this.client.logger.error(`[MUSIC_CHANNEL] Failed to fetch message ${messageId}: ${error}`);
                return null;
            });

            if (!message) {
                this.client.logger.warn(`[MUSIC_CHANNEL] Message with ID ${messageId} not found in channel ${channel.name}`);
                return null;
            }

            const currentTrack = player.queue.current;
            if (!currentTrack) {
                return await this.resetEmbed(messageId, channel);
            }

            const embed = new discord.EmbedBuilder()
                .setColor('Blurple')
                .setTitle(`${this.client.user?.username} Music Queue`)
                .setDescription(
                    `**🎵 Now Playing:**\n${Formatter.hyperlink(
                        Formatter.truncateText(currentTrack.title, 60),
                        currentTrack.uri
                    )}\nby **${currentTrack.author || "Unknown Artist"}**`
                )
                .setImage(currentTrack.thumbnail || currentTrack.artworkUrl || this.client.config.music.image)
                .setFooter({
                    text: `Requested by ${(currentTrack.requester as discord.User)?.tag || "Unknown"}`,
                    iconURL: this.client.user?.displayAvatarURL()
                })
                .setTimestamp();

            if (player.queue && player.queue.length > 0) {
                const queueList = player.queue
                    .slice(0, 5)
                    .map((track, index) => {
                        const requester = track.requester as discord.User;
                        return `**${index + 1}.** ${Formatter.hyperlink(
                            Formatter.truncateText(track.title, 40),
                            track.uri
                        )} - ${track.author || "Unknown Artist"}\n┗ Requested by: ${requester?.tag || "Unknown"}`;
                    })
                    .join("\n\n");

                const remainingTracks = player.queue.length > 5
                    ? `\n\n*+${player.queue.length - 5} more tracks in queue*`
                    : "";

                embed.addFields({
                    name: "🎶 Up Next:",
                    value: queueList + remainingTracks || "No tracks in queue",
                });
            }

            await message.edit({ embeds: [embed], components: [musicButton] }).catch(error => {
                this.client.logger.error(`[MUSIC_CHANNEL] Failed to edit message: ${error}`);
                return null;
            });

            this.client.logger.debug(`[MUSIC_CHANNEL] Successfully updated music panel for track: ${currentTrack.title}`);
            return message;
        } catch (error) {
            this.client.logger.error(`[MUSIC_CHANNEL] Failed to update queue embed: ${error}`);
            return null;
        }
    };

    /**
     * Resets the music channel embed to its initial state
     * @param messageId ID of the message to reset
     * @param channel Text channel containing the message
     * @returns Promise resolving to the reset message or null if reset failed
     */
    public resetEmbed = async (
        messageId: string,
        channel: discord.TextChannel
    ): Promise<discord.Message | null> => {
        try {
            const message = await channel.messages.fetch(messageId);
            if (!message) return null;
            const embed = this.setupMusicChannelEmbed();
            await message.edit({ embeds: [embed], components: [disabledMusicButton] });
            return message;
        } catch (error) {
            this.client.logger.error(`[MUSIC_CHANNEL] Failed to reset embed: ${error}`);
            return null;
        }
    };

    /**
     * Creates a new music channel embed message
     * @param channel Text channel to send the embed to
     * @returns Promise resolving to the created message or null if creation failed
     */
    public createMusicEmbed = async (
        channel: discord.TextChannel | any
    ): Promise<discord.Message | null> => {
        try {
            const embed = this.setupMusicChannelEmbed();
            return await channel.send({
                embeds: [embed],
                components: [disabledMusicButton]
            });
        } catch (error) {
            this.client.logger.error(`[MUSIC_CHANNEL] Failed to create music embed: ${error}`);
            return null;
        }
    };
}

const randomTips = (client: discord.Client): string => {
    const tips: string[] = client.config.content.text.random_tips;
    return tips[Math.floor(Math.random() * tips.length)];
}

export {
    disabledMusicButton,
    musicButton,
    musicEmbed,
    MusicResponseHandler,
    createTrackEmbed,
    createPlaylistEmbed,
    MusicChannelManager,
    randomTips
};