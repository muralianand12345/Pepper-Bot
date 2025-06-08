import discord from "discord.js";
import magmastream from "magmastream";

import Formatter from "../../../utils/format";
import { ITrackProgress } from "../../../types";


export class MusicResponseHandler {
    private readonly client: discord.Client;

    constructor(client: discord.Client) {
        this.client = client;
    };

    private trackProgress = (position: number, duration: number): ITrackProgress => {
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
    }

    public createSuccessEmbed = (message: string): discord.EmbedBuilder => {
        return new discord.EmbedBuilder()
            .setColor("#43b581")
            .setDescription(`✓ ${message}`)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            });
    };

    public createErrorEmbed = (message: string, contact_dev: boolean = false): discord.EmbedBuilder => {
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
    };

    public createInfoEmbed = (message: string): discord.EmbedBuilder => {
        return new discord.EmbedBuilder()
            .setColor("#5865f2")
            .setDescription(`ℹ️ ${message}`)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            });
    };

    public createWarningEmbed = (message: string): discord.EmbedBuilder => {
        return new discord.EmbedBuilder()
            .setColor("#faa61a")
            .setDescription(`⚠️ ${message}`)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            });
    };

    public createMusicEmbed = (track: magmastream.Track, player?: magmastream.Player): discord.EmbedBuilder => {
        const trackImg = track.thumbnail || track.artworkUrl;
        const trackTitle = Formatter.truncateText(track.title, 60);
        const trackAuthor = track.author || "Unknown";
        const trackUri = track.uri || "https://google.com"
        const defaultColor: discord.ColorResolvable = "#2b2d31";
        let progressText = "";

        if (player && player.queue && player.queue.current) {
            try {
                const position = Math.max(0, player.position);
                const duration = track.duration || 0;
                const progress = this.trackProgress(position, duration);
                const length = 15;
                const filledBlocks = Math.floor(progress.percentage * length);
                const progressBar = "▬".repeat(filledBlocks) + "●" + "▬".repeat(Math.max(0, length - filledBlocks - 1));

                progressText = `${progressBar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``;
            } catch (error) {
                progressText = "";
            }
        }

        const embed = new discord.EmbedBuilder()
            .setColor(defaultColor)
            .setTitle(`Now Playing`)
            .setDescription(`**${Formatter.hyperlink(trackTitle, trackUri)}**\nby **${trackAuthor}**`)
            .setThumbnail(trackImg);

        if (progressText) {
            embed.addFields([{ name: "Progress", value: progressText, inline: false }]);
            embed.setFooter({ text: `${track.sourceName || 'Unknown'} • ${track.requester?.tag || 'Unknown'}`, iconURL: this.client.user?.displayAvatarURL() }).setTimestamp();
            return embed;
        }

        return embed;
    };

    public createTrackEmbed = (track: magmastream.Track, position?: number | null): discord.EmbedBuilder => {
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

        if (queueInfo) fields.push({ name: "Queue Info", value: queueInfo, inline: false });
        return new discord.EmbedBuilder()
            .setColor("#5865f2")
            .setTitle(`Track Added to Queue`)
            .setDescription(`**${Formatter.hyperlink(title, url)}**\nby ${author}`)
            .setThumbnail(track.artworkUrl || track.thumbnail || null)
            .addFields(fields)
            .setFooter({
                text: this.client.user?.username || "Music Bot",
                iconURL: this.client.user?.displayAvatarURL()
            })
            .setTimestamp();
    };

    public createPlaylistEmbed = (playlist: magmastream.PlaylistData, requester: discord.User): discord.EmbedBuilder => {
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
                    value: requester.tag || "Unknown",
                    inline: false,
                }
            ])
            .setFooter({
                text: `Playlist loaded successfully`,
                iconURL: this.client.user?.displayAvatarURL()
            })
            .setTimestamp();
    };

    public getSupportButton = (): discord.ActionRowBuilder<discord.ButtonBuilder> => {
        return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
            new discord.ButtonBuilder()
                .setLabel("Support Server")
                .setStyle(discord.ButtonStyle.Link)
                .setURL("https://discord.gg/XzE9hSbsNb")
                .setEmoji("🔧")
        );
    };

    public getMusicButton = (disabled: boolean = false): discord.ActionRowBuilder<discord.ButtonBuilder> => {
        const row = new discord.ActionRowBuilder<discord.ButtonBuilder>();
        const buttonConfig = [
            { id: "pause-music", label: "Pause", emoji: "⏸️" },
            { id: "resume-music", label: "Resume", emoji: "▶️" },
            { id: "skip-music", label: "Skip", emoji: "⏭️" },
            { id: "stop-music", label: "Stop", emoji: "⏹️" },
            { id: "loop-music", label: "Loop", emoji: "🔄" },
        ];
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
};

