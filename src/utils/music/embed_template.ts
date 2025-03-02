import discord from "discord.js";
import magmastream from "magmastream";
import Formatter from "../format";
import { IConfig } from "../../types";

/**
 * Creates an embed for when no music is playing
 * @param client Discord client with configuration
 * @returns Promise<EmbedBuilder>
 */
const noMusicEmbed = async (client: discord.Client & { config: IConfig }) => {
    const prefixText = client.config.bot.command.disable_message
        ? "/"
        : client.config.bot.command.prefix;
    const defaultColor: discord.ColorResolvable = "#FF0000"; // Default red color

    return new discord.EmbedBuilder()
        .setColor(
            (client.config.content.embed.color.error ??
                defaultColor) as discord.ColorResolvable
        )
        .setImage(client.config.content.embed.no_music_playing.image)
        .setAuthor({
            name: client.config.content.embed.no_music_playing.author.name,
            iconURL:
                client.config.content.embed.no_music_playing.author.icon_url,
        })
        .setDescription(
            `> **${Formatter.hyperlink(
                `${client.user?.username}`,
                "https://discord.gg/XzE9hSbsNb"
            )}** | **Music Search Channel**`
        )
        .setFooter({ text: `Prefix is: ${prefixText}` });
};

/**
 * Creates an embed for the currently playing music
 * @param client Discord client with configuration
 * @param track Currently playing track
 * @returns Promise<EmbedBuilder>
 */
const musicEmbed = async (
    client: discord.Client & { config: IConfig },
    track: magmastream.Track
) => {
    const trackImg =
        track.displayThumbnail("maxresdefault") ||
        track.artworkUrl ||
        client.config.music.image;
    const trackAuthor = track.author || "Unknown";
    const trackTitle =
        track.title.length > 250 ? track.title.substring(0, 250) : track.title;
    const defaultColor: discord.ColorResolvable =
        client.config.content.embed.color.default;

    return new discord.EmbedBuilder()
        .setColor(
            (client.config.content.embed.color.default ??
                defaultColor) as discord.ColorResolvable
        )
        .setAuthor({
            name: `${trackTitle} By - ${trackAuthor}`,
            iconURL: client.user?.displayAvatarURL(),
        })
        .setImage(trackImg)
        .setFooter({ text: `Requested by ${track.requester?.tag}` })
        .setDescription(
            `> **Song Link: ${Formatter.hyperlink(
                "Click Me",
                `${track.uri}`
            )}** | **${Formatter.hyperlink(
                `${client.user?.username}`,
                "https://discord.gg/XzE9hSbsNb"
            )}**`
        );
};

// Button configurations remain the same
const buttonConfig = [
    { id: "pause-music", label: "Pause", emoji: "▶️" },
    { id: "resume-music", label: "Resume", emoji: "⏸️" },
    { id: "skip-music", label: "Skip", emoji: "⏭️" },
    { id: "stop-music", label: "Stop", emoji: "⏹️" },
    { id: "loop-music", label: "Loop", emoji: "🔁" },
];

/**
 * Creates a row of music control buttons
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
 * Creates a rich embed for displaying track information
 * @param {magmastream.Track} track - Music track information
 * @param {any} client - Discord client instance
 * @returns {discord.EmbedBuilder} Formatted embed for track
 */
const createTrackEmbed = (
    track: magmastream.Track,
    client: discord.Client
): discord.EmbedBuilder => {
    return new discord.EmbedBuilder()
        .setTitle("📀 Added to queue!")
        .setDescription(
            Formatter.hyperlink(Formatter.truncateText(track.title), track.uri)
        )
        .setThumbnail(track.artworkUrl)
        .setColor(client.config.content.embed.color.info)
        .addFields(
            {
                name: "Duration",
                value: `┕** \`${
                    track.isStream
                        ? "Live Stream"
                        : Formatter.msToTime(track.duration)
                }\`**`,
                inline: true,
            },
            {
                name: "Requested by",
                value: `┕** ${track.requester}**`,
                inline: true,
            },
            { name: "Author", value: `┕** ${track.author}**`, inline: true }
        );
};

/**
 * Creates a rich embed for displaying playlist information
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
    return new discord.EmbedBuilder()
        .setTitle("📋 Added playlist to queue!")
        .setDescription(
            Formatter.hyperlink(
                Formatter.truncateText(playlist.name || "", 50),
                query
            )
        )
        .setThumbnail(playlist.tracks[0].artworkUrl || "")
        .setColor(client.config.content.embed.color.success)
        .addFields(
            {
                name: "Playlist Duration",
                value: `┕** \`${Formatter.msToTime(
                    playlist.duration || 0
                )}\`**`,
                inline: true,
            },
            {
                name: "Total Tracks",
                value: `┕** ${playlist.tracks.length}**`,
                inline: true,
            },
            { name: "Requested by", value: `┕** ${requester}**`, inline: true }
        );
};

/**
 * Handles music button interaction responses
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
        const color =
            this.client.config.content.embed.color.success ?? "#FF0000";
        return new discord.EmbedBuilder()
            .setColor(color as discord.ColorResolvable)
            .setDescription(message);
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
        const color = this.client.config.content.embed.color.error ?? "#FF0000";
        const embed = new discord.EmbedBuilder()
            .setColor(color as discord.ColorResolvable)
            .setDescription(message);

        if (contact_dev) {
            embed.setFooter({
                text: "If this issue persists, please use `/feedback` or contact the developer.",
                iconURL: this.client.user?.displayAvatarURL(),
            });
        }

        return embed;
    }

    /**
     * Creates an info embed for music actions
     * @param {string} message - Info message
     * @returns {discord.EmbedBuilder} Configured info embed
     */
    public createInfoEmbed(message: string): discord.EmbedBuilder {
        const color = this.client.config.content.embed.color.info ?? "#FF0000";
        return new discord.EmbedBuilder()
            .setColor(color as discord.ColorResolvable)
            .setDescription(message);
    }

    /**
     * Creates a warning embed for music actions
     * @param {string} message - Warning message
     * @returns {discord.EmbedBuilder} Configured warning embed
     */
    public createWarningEmbed(message: string): discord.EmbedBuilder {
        const color =
            this.client.config.content.embed.color.warning ?? "#FF0000";
        return new discord.EmbedBuilder()
            .setColor(color as discord.ColorResolvable)
            .setDescription(message);
    }

    /**
     * Gets support button for error messages
     * @returns {discord.ActionRowBuilder<discord.ButtonBuilder>} Support button component
     */
    public getSupportButton(): discord.ActionRowBuilder<discord.ButtonBuilder> {
        return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
            new discord.ButtonBuilder()
                .setLabel("Pepper Support")
                .setStyle(discord.ButtonStyle.Link)
                .setURL("https://discord.gg/XzE9hSbsNb")
        );
    }
}

const disabldMusicButton = createMusicButtons(true);
const musicButton = createMusicButtons(false);

export {
    disabldMusicButton,
    musicButton,
    noMusicEmbed,
    musicEmbed,
    MusicResponseHandler,
    createTrackEmbed,
    createPlaylistEmbed,
};
