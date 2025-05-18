import discord from "discord.js";
import Formatter from "../../utils/format";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import PlaylistSuggestion from "../../utils/music/playlist_suggestion";
import { SlashCommand, ISongs } from "../../types";

const spotifyRecommendCommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("suggest-songs")
        .setDescription(
            "Get Spotify music recommendations based on your listening history"
        )
        .addIntegerOption((option) =>
            option
                .setName("count")
                .setDescription("Number of recommendations to get")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20)
        )
        .setContexts(discord.InteractionContextType.Guild),

    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
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

        if (!interaction.guild) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "This command can only be used in a server"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        const count = interaction.options.getInteger("count") || 10;

        await interaction.deferReply();

        try {
            const suggestionEngine = new PlaylistSuggestion(client);

            const { seedSong, recommendations } =
                await suggestionEngine.getSuggestionsFromUserTopSong(
                    interaction.user.id,
                    interaction.guild.id,
                    count
                );

            if (!seedSong) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            "You don't have any listening history yet. Play some songs first!"
                        ),
                    ],
                });
            }

            if (!recommendations || recommendations.length === 0) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            `No recommendations found based on "${seedSong.title}". Try playing more varied songs!`
                        ),
                    ],
                });
            }

            const spotifyCount = recommendations.filter(
                (track) =>
                    track && track.uri && track.uri.includes("spotify.com")
            ).length;

            const formatRecommendation = (
                track: ISongs,
                index: number
            ): string => {
                if (!track || !track.title || !track.author) {
                    return `**${index + 1}.** Unknown Track`;
                }

                const title = Formatter.truncateText(track.title, 40);
                const author = Formatter.truncateText(track.author, 20);
                const isSpotify =
                    track.uri && track.uri.includes("spotify.com");
                const icon = isSpotify ? "🟢" : "🎵";
                const trackUri = track.uri || "#";

                return `${icon} **${index + 1}.** ${Formatter.hyperlink(
                    title,
                    trackUri
                )} - **${author}**`;
            };

            const embed = new discord.EmbedBuilder()
                .setColor("#1DB954") // Spotify green
                .setTitle("🎵 Spotify Recommendations")
                .setDescription(
                    `Based on your top song: **${Formatter.truncateText(
                        seedSong.title || "Unknown Title",
                        40
                    )}** by **${seedSong.author || "Unknown Artist"}**\n\n` +
                    `Found ${spotifyCount} Spotify tracks out of ${recommendations.length} recommendations`
                )
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp();

            if (seedSong.thumbnail || seedSong.artworkUrl) {
                embed.setThumbnail(
                    seedSong.thumbnail || seedSong.artworkUrl || null
                );
            }

            if (recommendations.length > 0) {
                const firstGroup = recommendations
                    .slice(0, 5)
                    .map((track, index) => formatRecommendation(track, index))
                    .join("\n");

                embed.addFields({
                    name: "Top Recommendations",
                    value: firstGroup || "No valid recommendations found",
                });

                if (recommendations.length > 5) {
                    const secondGroup = recommendations
                        .slice(5, 10)
                        .map((track, index) =>
                            formatRecommendation(track, index + 5)
                        )
                        .join("\n");

                    embed.addFields({
                        name: "More Recommendations",
                        value: secondGroup || "No additional recommendations",
                    });
                }

                if (recommendations.length > 10) {
                    const thirdGroup = recommendations
                        .slice(10, Math.min(15, recommendations.length))
                        .map((track, index) =>
                            formatRecommendation(track, index + 10)
                        )
                        .join("\n");

                    embed.addFields({
                        name: "Additional Recommendations",
                        value: thirdGroup || "No additional recommendations",
                    });
                }
            }

            const row =
                new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
                    new discord.ButtonBuilder()
                        .setCustomId("play-recommendation-first")
                        .setLabel("Play Top Pick")
                        .setStyle(discord.ButtonStyle.Success)
                        .setEmoji("▶️"),
                    new discord.ButtonBuilder()
                        .setCustomId("add-recommendation-queue")
                        .setLabel("Add All to Queue")
                        .setStyle(discord.ButtonStyle.Primary)
                        .setEmoji("📋"),
                    new discord.ButtonBuilder()
                        .setCustomId("refresh-recommendation")
                        .setLabel("Get New Suggestions")
                        .setStyle(discord.ButtonStyle.Secondary)
                        .setEmoji("🔄")
                );

            const player = client.manager.get(interaction.guild.id);
            const message = await interaction.editReply({
                embeds: [embed],
                components: player ? [row] : [],
            });

            if (player) {
                const collector = message.createMessageComponentCollector({
                    filter: (i) => i.user.id === interaction.user.id,
                    time: 60000,
                });

                collector.on("collect", async (i) => {
                    try {
                        if (
                            i.customId === "play-recommendation-first" &&
                            recommendations.length > 0
                        ) {
                            await i.deferUpdate();

                            const topPick = recommendations[0];
                            if (!topPick || !topPick.uri) {
                                await i.followUp({
                                    embeds: [
                                        new MusicResponseHandler(
                                            client
                                        ).createErrorEmbed(
                                            "Invalid track data for the top recommendation",
                                            true
                                        ),
                                    ],
                                    components: [
                                        new MusicResponseHandler(
                                            client
                                        ).getSupportButton(),
                                    ],
                                    flags: discord.MessageFlags.Ephemeral,
                                });
                                return;
                            }

                            const searchResult = await client.manager.search(
                                topPick.uri,
                                interaction.user
                            );

                            if (
                                searchResult.tracks &&
                                searchResult.tracks.length > 0
                            ) {
                                player.queue.unshift(searchResult.tracks[0]);
                                player.stop();

                                await i.followUp({
                                    embeds: [
                                        new MusicResponseHandler(
                                            client
                                        ).createSuccessEmbed(
                                            `Now playing: **${topPick.title || "Unknown Track"
                                            }** by **${topPick.author ||
                                            "Unknown Artist"
                                            }**`
                                        ),
                                    ],
                                    flags: discord.MessageFlags.Ephemeral,
                                });
                            }
                        } else if (i.customId === "add-recommendation-queue") {
                            await i.deferUpdate();

                            let addedCount = 0;
                            for (const rec of recommendations) {
                                try {
                                    if (!rec || !rec.uri) continue;

                                    const searchResult =
                                        await client.manager.search(
                                            rec.uri,
                                            interaction.user
                                        );
                                    if (
                                        searchResult.tracks &&
                                        searchResult.tracks.length > 0
                                    ) {
                                        player.queue.add(
                                            searchResult.tracks[0]
                                        );
                                        addedCount++;
                                    }
                                } catch (err) {
                                    client.logger.error(
                                        `Failed to add track to queue: ${err}`
                                    );
                                }
                            }

                            if (
                                !player.playing &&
                                !player.paused &&
                                player.queue.size > 0
                            ) {
                                player.play();
                            }

                            await i.followUp({
                                embeds: [
                                    new MusicResponseHandler(
                                        client
                                    ).createSuccessEmbed(
                                        `Added ${addedCount} tracks to the queue!`
                                    ),
                                ],
                                flags: discord.MessageFlags.Ephemeral,
                            });
                        } else if (i.customId === "refresh-recommendation") {
                            await i.deferUpdate();
                            const {
                                seedSong: newSeedSong,
                                recommendations: newRecommendations,
                            } =
                                await suggestionEngine.getSuggestionsFromUserTopSong(
                                    interaction.user.id,
                                    interaction.guild?.id || "",
                                    count
                                );

                            if (
                                !newSeedSong ||
                                !newRecommendations ||
                                newRecommendations.length === 0
                            ) {
                                await i.followUp({
                                    embeds: [
                                        new MusicResponseHandler(
                                            client
                                        ).createInfoEmbed(
                                            "No new recommendations found"
                                        ),
                                    ],
                                    flags: discord.MessageFlags.Ephemeral,
                                });
                                return;
                            }

                            const newSpotifyCount = newRecommendations.filter(
                                (track) =>
                                    track &&
                                    track.uri &&
                                    track.uri.includes("spotify.com")
                            ).length;

                            const updatedEmbed = new discord.EmbedBuilder()
                                .setColor("#1DB954")
                                .setTitle("🎵 Fresh Spotify Recommendations")
                                .setDescription(
                                    `Based on your top song: **${Formatter.truncateText(
                                        newSeedSong.title || "Unknown Title",
                                        40
                                    )}** by **${newSeedSong.author || "Unknown Artist"
                                    }**\n\n` +
                                    `Found ${newSpotifyCount} Spotify tracks out of ${newRecommendations.length} recommendations`
                                )
                                .setFooter({
                                    text: `Refreshed by ${interaction.user.tag}`,
                                    iconURL:
                                        interaction.user.displayAvatarURL(),
                                })
                                .setTimestamp();

                            if (
                                newSeedSong.thumbnail ||
                                newSeedSong.artworkUrl
                            ) {
                                updatedEmbed.setThumbnail(
                                    newSeedSong.thumbnail ||
                                    newSeedSong.artworkUrl ||
                                    null
                                );
                            }

                            if (newRecommendations.length > 0) {
                                const firstGroup = newRecommendations
                                    .slice(0, 5)
                                    .map((track, index) =>
                                        formatRecommendation(track, index)
                                    )
                                    .join("\n");

                                updatedEmbed.addFields({
                                    name: "Top Recommendations",
                                    value:
                                        firstGroup ||
                                        "No valid recommendations found",
                                });

                                if (newRecommendations.length > 5) {
                                    const secondGroup = newRecommendations
                                        .slice(5, 10)
                                        .map((track, index) =>
                                            formatRecommendation(
                                                track,
                                                index + 5
                                            )
                                        )
                                        .join("\n");

                                    updatedEmbed.addFields({
                                        name: "More Recommendations",
                                        value:
                                            secondGroup ||
                                            "No additional recommendations",
                                    });
                                }

                                if (newRecommendations.length > 10) {
                                    const thirdGroup = newRecommendations
                                        .slice(
                                            10,
                                            Math.min(
                                                15,
                                                newRecommendations.length
                                            )
                                        )
                                        .map((track, index) =>
                                            formatRecommendation(
                                                track,
                                                index + 10
                                            )
                                        )
                                        .join("\n");

                                    updatedEmbed.addFields({
                                        name: "Additional Recommendations",
                                        value:
                                            thirdGroup ||
                                            "No additional recommendations",
                                    });
                                }
                            }

                            await interaction.editReply({
                                embeds: [updatedEmbed],
                                components: [row],
                            });
                        }
                    } catch (error) {
                        client.logger.error(
                            `Button interaction error: ${error}`
                        );
                        await i.reply({
                            embeds: [
                                new MusicResponseHandler(
                                    client
                                ).createErrorEmbed(
                                    "An error occurred while processing your request",
                                    true
                                ),
                            ],
                            components: [
                                new MusicResponseHandler(
                                    client
                                ).getSupportButton(),
                            ],
                            flags: discord.MessageFlags.Ephemeral,
                        });
                    }
                });

                collector.on("end", async () => {
                    row.components.forEach((button) =>
                        button.setDisabled(true)
                    );
                    await interaction
                        .editReply({
                            components: [row],
                        })
                        .catch(() => { });
                });
            }
        } catch (error) {
            client.logger.error(`[SPOTIFY_RECOMMEND] Error: ${error}`);
            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to generate recommendations",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
            });
        }
    },
};

export default spotifyRecommendCommand;
