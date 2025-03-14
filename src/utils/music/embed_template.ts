import discord from "discord.js";
import magmastream from "magmastream";
import Formatter from "../format";
import { IConfig } from "../../types";

// Create a function that returns both the adjusted time and progress percentage
const getTrackProgress = (position: number, duration: number): {
    displayPosition: number;
    percentage: number;
    formattedPosition: string;
    formattedDuration: string;
} => {
    // Ensure position doesn't exceed duration
    const normalizedPosition = Math.min(position, duration);

    // Logic for end-of-track adjustments
    let adjustedPosition = normalizedPosition;
    const remainingTime = duration - normalizedPosition;

    if (remainingTime < 10000) {
        // Adjust position for display, but keep actual time for counters
        adjustedPosition = Math.min(normalizedPosition + (10000 - remainingTime) / 2, duration - 100);
    }

    // Calculate percentage for progress bar
    const percentage = Math.min(adjustedPosition / duration, 0.999); // Cap at 99.9%

    // Format times for display (use the original position for time display)
    const formattedPosition = Formatter.msToTime(normalizedPosition);
    const formattedDuration = Formatter.msToTime(duration);

    return {
        displayPosition: normalizedPosition, // Unadjusted for time display
        percentage,                        // Adjusted for progress bar
        formattedPosition,
        formattedDuration
    };
};

/**
 * Creates a progress bar with emoji indicators
 * @param position Current position in milliseconds
 * @param duration Total duration in milliseconds
 * @param length Number of segments in the bar
 * @returns Formatted progress bar string
 */
const createProgressBar = (position: number, duration: number, length: number = 15): string => {
    // Get the track progress data
    const progress = getTrackProgress(position, duration);

    // Use the percentage to create the bar
    const filledBlocks = Math.floor(progress.percentage * length);

    // Build the progress bar
    return "▬".repeat(Math.max(0, filledBlocks)) +
        "●" +
        "▬".repeat(Math.max(0, length - filledBlocks - 1));
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
    const trackImg =
        track.displayThumbnail("maxresdefault") ||
        track.artworkUrl ||
        client.config.music.image;

    // Format track title and author for display
    const trackTitle = Formatter.truncateText(track.title, 60);
    const trackAuthor = track.author || "Unknown";
    const trackUri = track.uri || "https://google.com"

    const defaultColor: discord.ColorResolvable = "#2b2d31"; // Modern discord dark

    // Create progress information if player is available
    let progressText = "";

    if (player && player.queue && player.queue.current) {
        try {
            // Get time values
            const position = Math.max(0, player.position);
            const duration = track.duration || 0;

            // Use the getTrackProgress function instead of separate calculations
            const progress = getTrackProgress(position, duration);

            // Create progress bar using the adjusted percentage
            const length = 15; // Number of segments
            const filledBlocks = Math.floor(progress.percentage * length);
            const progressBar = "▬".repeat(filledBlocks) + "●" + "▬".repeat(Math.max(0, length - filledBlocks - 1));

            // Use the formatted times from the progress calculation
            progressText = `${progressBar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``;
        } catch (error) {
            // Fallback if progress calculation fails
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

    // Add progress field if we have progress info
    if (progressText) {
        embed.addFields([{
            name: "Progress",
            value: progressText,
            inline: false
        }]);
    }

    // Add source and requester info in footer
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
    // Format track info
    const title = Formatter.truncateText(track.title, 60);
    const url = track.uri || "https://google.com";
    const author = track.author || "Unknown";
    const duration = track.isStream ? "LIVE" : Formatter.msToTime(track.duration);

    // Position info
    let queueInfo = "";
    if (position === 0) {
        queueInfo = "Playing next";
    } else if (position !== null && position !== undefined) {
        queueInfo = `Position #${position + 1}`;
    }

    // Create fields
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

    // Add queue info field if available
    if (queueInfo) {
        fields.push({
            name: "Queue Info",
            value: queueInfo,
            inline: false,
        });
    }

    return new discord.EmbedBuilder()
        .setColor("#5865f2") // Discord blurple
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
    // Format playlist name
    const playlistName = Formatter.truncateText(playlist.name || "Untitled Playlist", 50);

    // Format track previews
    const trackPreview = playlist.tracks
        .slice(0, 5)
        .map((track, i) => {
            const title = Formatter.truncateText(track.title, 40);
            return `**${i + 1}.** ${title}`;
        })
        .join("\n");

    // Text for more tracks
    const moreTracksText = playlist.tracks.length > 5
        ? `\n*...and ${playlist.tracks.length - 5} more tracks*`
        : "";

    // Format duration
    const totalDuration = Formatter.msToTime(playlist.duration || 0);

    // Calculate average duration
    let avgDuration = "0:00:00";
    if (playlist.tracks.length > 0) {
        const avgMs = Math.floor(playlist.duration / playlist.tracks.length);
        avgDuration = Formatter.msToTime(avgMs);
    }

    return new discord.EmbedBuilder()
        .setColor("#43b581") // Discord green
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
            .setColor("#43b581") // Discord green
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
            .setColor("#f04747") // Discord red
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
            .setColor("#5865f2") // Discord blurple
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
            .setColor("#faa61a") // Discord yellow
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
}

const disabledMusicButton = createMusicButtons(true);
const musicButton = createMusicButtons(false);

export {
    disabledMusicButton,
    musicButton,
    musicEmbed,
    MusicResponseHandler,
    createTrackEmbed,
    createPlaylistEmbed,
};