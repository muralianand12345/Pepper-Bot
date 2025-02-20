import discord from "discord.js";
import magmastream from "magmastream";
import Formatter from "../../utils/format";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { SlashCommand, ITrackFormatOptions, ILastFmTrack } from "../../types";

/**
 * Determines if a track is from Last.fm format
 * @param track - Track to check
 * @returns Boolean indicating if track is Last.fm format
 */
const isLastFmTrack = (track: any): track is ILastFmTrack => {
    return (
        "playcount" in track &&
        "match" in track &&
        "artist" in track &&
        typeof track.artist === "object"
    );
};

/**
 * Formats play count with K/M suffix
 * @param count - Number of plays
 * @returns Formatted play count string
 */
const formatPlaycount = (count: number): string => {
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M plays`;
    } else if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1)}K plays`;
    }
    return `${count} plays`;
};

/**
 * Formats a single track for display
 * @param track - Track to format
 * @param index - Track index in list
 * @param similarity - Similarity score
 * @param options - Formatting options
 * @returns Formatted track string
 */
const formatTrack = (
    track: magmastream.Track | ILastFmTrack,
    index: number,
    similarity: number,
    options: ITrackFormatOptions = {}
): string => {
    const {
        maxTitleLength = 45,
        maxArtistLength = 20,
        includeDuration = true,
    } = options;

    if (isLastFmTrack(track)) {
        // Format Last.fm track
        const trackName = Formatter.truncateText(track.name, maxTitleLength);
        const artistName = Formatter.truncateText(
            track.artist.name,
            maxArtistLength
        );
        const matchPercent = `${(track.match * 100).toFixed(1)}%`;
        const plays = formatPlaycount(track.playcount);

        return (
            `**${index + 1}.** ${Formatter.hyperlink(
                trackName,
                track.url
            )} by **${artistName}**\n` +
            `┗ Match: \`${matchPercent}\` • ${plays}`
        );
    } else {
        // Format MagmaStream track
        const trackName = Formatter.truncateText(
            track.title || "Unknown Track",
            maxTitleLength
        );
        const artistName = Formatter.truncateText(
            track.author || "Unknown Artist",
            maxArtistLength
        );
        const matchPercent = `${((1 - index * 0.1) * 100).toFixed(1)}%`;
        const duration =
            includeDuration && track.duration
                ? ` • \`${Formatter.msToTime(track.duration).substring(3)}\``
                : "";

        return (
            `**${index + 1}.** ${Formatter.hyperlink(
                trackName,
                track.uri || "#"
            )} by **${artistName}**\n` +
            `┗ Match: \`${matchPercent}\`${duration}`
        );
    }
};

/**
 * Command to suggest similar songs based on the currently playing track
 */
const suggestSongsCommand: SlashCommand = {
    cooldown: 15,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("suggest-songs")
        .setDescription(
            "Beta feature: Suggest similar songs based on the current track"
        )
        .setContexts(discord.InteractionContextType.Guild),

    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        // Music system validation
        if (!client.config.music.enabled) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Music is currently disabled"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        // Player validation
        const player = client.manager.get(interaction.guild?.id || "");
        if (!player) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "No music is currently playing"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        // Voice channel validation
        const validator = new VoiceChannelValidator(client, interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) {
                return await interaction.reply({
                    embeds: [embed],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        }

        await interaction.deferReply();

        try {
            const currentTrack = player.queue.current;
            if (!currentTrack?.title) {
                throw new Error("No valid track currently playing");
            }

            const tracks = await player.getRecommendedTracks(currentTrack);

            if (!tracks?.length) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            "No recommendations found for the current track"
                        ),
                    ],
                });
            }

            // Create formatted track groups
            const firstGroup = tracks
                .slice(0, 5)
                .map((track, index) =>
                    formatTrack(track, index, 1 - index * 0.1)
                )
                .join("\n\n");

            const secondGroup = tracks
                .slice(5, 10)
                .map((track, index) =>
                    formatTrack(track, index + 5, 1 - (index + 5) * 0.1)
                )
                .join("\n\n");

            const embed = new discord.EmbedBuilder()
                .setColor(client.config.content.embed.color.default)
                .setTitle("🎵 Similar Songs You Might Like")
                .setDescription(
                    `Based on your current track: **${Formatter.truncateText(
                        currentTrack.title,
                        45
                    )}**\n` +
                        `by **${currentTrack.author}** \`${Formatter.msToTime(
                            currentTrack.duration
                        ).substring(3)}\`\n` +
                        "*Here are some songs with similar vibes:*"
                )
                .addFields(
                    {
                        name: "Top Recommendations",
                        value: firstGroup || "No recommendations found",
                    },
                    {
                        name: "More Suggestions",
                        value: secondGroup || "No additional recommendations",
                    }
                )
                .setThumbnail(
                    currentTrack.thumbnail || currentTrack.artworkUrl || null
                )
                .setFooter({
                    text: `Requested by ${interaction.user.tag} • Powered by MagmaStream and Last.fm`,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            client.logger.error(
                `[SUGGEST_SONGS] SuggestSongs | Error: ${error}`
            );

            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to fetch song recommendations"
                    ),
                ],
            });
        }
    },
};

export default suggestSongsCommand;
