// BETA FEATURE - May produce unexpected results

import discord from "discord.js";
import magmastream, { TrackUtils } from 'magmastream';

import { AI } from "../core/ai";
import Formatter from '../utils/format';
import { Command, ISongs, CommandCategory } from '../types';

const groovyCommand: Command = {
    cooldown: 3600,
    category: CommandCategory.MUSIC,
    data: new discord.SlashCommandBuilder()
        .setName("groovy")
        .setDescription("[BETA] AI powered music recommendations")
        .addStringOption((option) => option.setName("query").setDescription("Whats in your mind?").setRequired(true)),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        await interaction.deferReply();

        const ai = new AI();
        const query = interaction.options.getString("query", true);

        const wait_embed = new discord.EmbedBuilder()
            .setDescription("Generating music recommendations... This may take a while.")
            .setColor("Yellow")
            .setFooter({ text: "Note: This feature is in BETA and may produce unexpected results." });

        await interaction.editReply({ embeds: [wait_embed] });

        (async () => {
            const startTime = Date.now();
            try {
                const recommendations: ISongs[] = [];
                const response = await ai.getSpotifySongs(query);

                const convertTrackToISongs = (track: magmastream.Track): ISongs => {
                    return {
                        track: track.title || 'Unknown Track',
                        artworkUrl: track.artworkUrl || '',
                        sourceName: track.sourceName || 'unknown',
                        title: track.title || 'Unknown Track',
                        identifier: track.identifier || `unknown_${Date.now()}`,
                        author: track.author || 'Unknown Artist',
                        duration: track.duration || 0,
                        isrc: track.isrc || '',
                        isSeekable: track.isSeekable !== undefined ? track.isSeekable : true,
                        isStream: track.isStream !== undefined ? track.isStream : false,
                        uri: track.uri || '',
                        thumbnail: track.thumbnail || null,
                        requester: track.requester ? { ...track.requester, avatar: track.requester.avatar || undefined } : null,
                        played_number: 1,
                        timestamp: new Date(),
                    };
                };

                client.logger.success(`Groovy: Received ${response.songs.length} song recommendations for query "${query}"`);

                for (const song of response.songs) {
                    let result = await client.manager.search(`spsearch:${song.song_name} ${song.artist}`, interaction.user);
                    if (TrackUtils.isErrorOrEmptySearchResult(result) || !('tracks' in result) || !result.tracks?.length) {
                        result = await client.manager.search(`${song.song_name} ${song.artist}`, interaction.user);
                        if (TrackUtils.isErrorOrEmptySearchResult(result) || !('tracks' in result) || !result.tracks?.length) throw new Error('No searchable track found');
                    }
                    client.logger.info(`Groovy: Found track for "${song.song_name}" by "${song.artist}" - ${result.tracks[0].title} (${result.tracks[0].uri})`);
                    recommendations.push(convertTrackToISongs(result.tracks[0]));
                }

                const executionTime = Date.now() - startTime;

                if (!recommendations || recommendations.length === 0) {
                    const noResultsEmbed = new discord.EmbedBuilder().setDescription("No music recommendations found.").setColor("Red");
                    await interaction.editReply({ embeds: [noResultsEmbed] });
                    return;
                }

                const sourceBreakdown = recommendations.reduce(
                    (acc, track) => {
                        if (track.uri.includes('spotify.com')) {
                            acc.spotify++;
                        } else if (track.sourceName === 'YouTube') {
                            acc.youtube++;
                        } else if (track.sourceName === 'SoundCloud') {
                            acc.soundcloud++;
                        } else {
                            acc.other++;
                        }
                        return acc;
                    },
                    { spotify: 0, youtube: 0, soundcloud: 0, other: 0 }
                );

                const formatRecommendation = (track: ISongs, index: number): string => {
                    if (!track || !track.title || !track.author) {
                        return `**${index + 1}.** Unknown Track`;
                    }

                    const title = Formatter.truncateText(track.title, 40);
                    const author = Formatter.truncateText(track.author, 20);
                    const isSpotify = track.uri && track.uri.includes('spotify.com');
                    const icon = isSpotify ? '🟢' : track.sourceName === 'YouTube' ? '🔴' : track.sourceName === 'SoundCloud' ? '🟠' : '🎵';
                    const trackUri = track.uri || '#';

                    return `${icon} **${index + 1}.** ${Formatter.hyperlink(title, trackUri)} - **${author}**`;
                };

                const embed = new discord.EmbedBuilder()
                    .setColor('#1DB954')
                    .setDescription(`${response.response}`)
                    .setFooter({ text: 'Chat history aren\'t saved. AI doesn\'t remember past interactions.' })
                    .setTimestamp();

                if (recommendations.length > 0) {
                    const firstGroup = recommendations
                        .slice(0, 5)
                        .map((track, index) => formatRecommendation(track, index))
                        .join('\n');
                    embed.addFields({
                        name: 'Top Picks',
                        value: firstGroup || 'No recommendations found.',
                    });
                }

                if (recommendations.length > 5) {
                    const secondGroup = recommendations
                        .slice(5, 10)
                        .map((track, index) => formatRecommendation(track, index + 5))
                        .join('\n');
                    embed.addFields({
                        name: 'More Recommendations',
                        value: secondGroup || 'No additional recommendations found.',
                    });
                }

                if (recommendations.length > 10) {
                    const thirdGroup = recommendations
                        .slice(10)
                        .map((track, index) => formatRecommendation(track, index + 10))
                        .join('\n');
                    embed.addFields({
                        name: 'Even More Recommendations',
                        value: thirdGroup || 'No further recommendations found.',
                    });
                }

                const sourcesText = [
                    sourceBreakdown.spotify > 0 ? `🟢 ${sourceBreakdown.spotify} Spotify` : null,
                    sourceBreakdown.youtube > 0 ? `🔴 ${sourceBreakdown.youtube} YouTube` : null,
                    sourceBreakdown.soundcloud > 0 ? `🟠 ${sourceBreakdown.soundcloud} SoundCloud` : null,
                    sourceBreakdown.other > 0 ? `🎵 ${sourceBreakdown.other} Other` : null,
                ]
                    .filter(Boolean)
                    .join(' • ');
                if (sourcesText) {
                    embed.addFields({
                        name: '📊 Sources',
                        value: sourcesText,
                        inline: false,
                    });
                }

                embed.addFields({
                    name: '⚡ Performance',
                    value: `Generated in ${executionTime / 1000} seconds`,
                    inline: true,
                });

                await interaction.editReply({
                    embeds: [embed],
                });
            } catch (error) {
                client.logger.error(`Error fetching music recommendations: ${error}`);
                const errorEmbed = new discord.EmbedBuilder()
                    .setTitle("Error")
                    .setDescription("Failed to generate music recommendations. Please try again later.")
                    .setColor("Red");
                try {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } catch (_) {
                    // ignore
                }
            }
        })();
    },
};

export default groovyCommand;
