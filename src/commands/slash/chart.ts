import discord from "discord.js";
import Formatter from "../../utils/format";
import MusicDB from "../../utils/music/music_db";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { SlashCommand, ISongs } from "../../types";

const musicChartCommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("chart")
        .setDescription("View music listening charts and statistics")
        .setContexts(discord.InteractionContextType.Guild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("personal")
                .setDescription("View your personal music statistics")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("guild")
                .setDescription("View this server's music statistics")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("user")
                .setDescription("View another user's music statistics")
                .addUserOption((option) =>
                    option
                        .setName("target")
                        .setDescription("The user to check")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("global")
                .setDescription(
                    "View global music statistics across all servers"
                )
        ),

    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();
            let data: { songs: ISongs[] } | null = null;
            let title = "";
            let description = "";
            let targetUser = interaction.user;

            switch (subcommand) {
                case "personal":
                    data = await MusicDB.getUserMusicHistory(
                        interaction.user.id
                    );
                    title = `${interaction.user.username}'s Music Journey`;
                    description =
                        "Your personal music listening journey with Pepper!";
                    break;

                case "guild":
                    if (!interaction.guildId) {
                        throw new Error(
                            "This command can only be used in a server"
                        );
                    }
                    data = await MusicDB.getGuildMusicHistory(
                        interaction.guildId
                    );
                    title = `${interaction.guild?.name || "Server"
                        }'s Musical Adventure`;
                    description = `Explore the musical tastes of ${interaction.guild?.name || "this server"
                        }!`;
                    break;

                case "user":
                    targetUser = interaction.options.getUser("target")!;
                    if (!targetUser) {
                        throw new Error("User not found");
                    }
                    data = await MusicDB.getUserMusicHistory(targetUser.id);
                    title = `${targetUser.username}'s Music Collection`;
                    description =
                        "Dive into the musical journey of a passionate listener!";
                    break;

                case "global":
                    data = await MusicDB.getGlobalMusicHistory();
                    title = "🌍 Global Music Chart";
                    description =
                        "Discover the most popular tracks across all servers!";
                    break;
            }

            // Handle the case when no data is found or songs array is empty/undefined
            if (!data || !data.songs || data.songs.length === 0) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            `🎵 No music history found for ${subcommand === "global"
                                ? "any servers"
                                : subcommand === "guild"
                                    ? interaction.guild?.name || "this server"
                                    : targetUser.username
                            }!`
                        ),
                    ],
                });
            }

            // Filter out invalid songs (songs with 0 plays or missing essential data)
            const validSongs = data.songs.filter(
                (song) => song.played_number > 0 && song.title && song.author
            );

            if (validSongs.length === 0) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            `🎵 No valid music history found for ${subcommand === "global"
                                ? "any servers"
                                : subcommand === "guild"
                                    ? interaction.guild?.name || "this server"
                                    : targetUser.username
                            }! Start listening to see your stats!`
                        ),
                    ],
                });
            }

            // Advanced statistics calculations
            const totalPlays = validSongs.reduce(
                (sum, song) => sum + (song.played_number || 0),
                0
            );
            const uniqueSongs = validSongs.length;
            const topSongs = [...validSongs]
                .sort((a, b) => (b.played_number || 0) - (a.played_number || 0))
                .slice(0, 10);

            // Calculate favorite artists
            const artistStats: Record<string, number> = {};
            validSongs.forEach((song) => {
                const author = song.author || "Unknown Artist";
                artistStats[author] =
                    (artistStats[author] || 0) + (song.played_number || 0);
            });

            const topArtists = Object.entries(artistStats)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([artist, plays]) => `${artist} (\`${plays}\` plays)`);

            // Calculate total listening time
            const totalDuration = validSongs.reduce(
                (sum, song) =>
                    sum + (song.duration || 0) * (song.played_number || 0),
                0
            );

            // Create the chart visualization
            const maxPlays =
                topSongs.length > 0 ? topSongs[0].played_number || 0 : 0;
            const barLength = 15;

            const songList = topSongs
                .map((song, index) => {
                    const plays = song.played_number || 0;
                    const bars = Math.round(
                        (plays / Math.max(maxPlays, 1)) * barLength
                    );
                    const barDisplay =
                        "▰".repeat(bars) + "▱".repeat(barLength - bars);
                    const percentage = (
                        (plays / Math.max(totalPlays, 1)) *
                        100
                    ).toFixed(1);

                    return `\`${(index + 1)
                        .toString()
                        .padStart(
                            2,
                            "0"
                        )}\` ${barDisplay} **${Formatter.truncateText(
                            song.title || "Unknown Title",
                            30
                        )}**\n┗ by *${song.author || "Unknown Artist"
                        }* • \`${plays}\` plays • ${percentage}%`;
                })
                .join("\n\n");

            const embed = new discord.EmbedBuilder()
                .setColor(client.config.content.embed.color.info)
                .setTitle(`🎵 ${title}`)
                .setAuthor({
                    name: `Music Statistics Overview`,
                    iconURL: targetUser.displayAvatarURL(),
                })
                .setDescription(
                    `${description}\n\n` +
                    `**📊 Overview Statistics**\n` +
                    `• Total Plays: \`${totalPlays}\` tracks played\n` +
                    `• Unique Songs: \`${uniqueSongs}\` different tracks\n` +
                    `• Total Listening Time: \`${Formatter.msToTime(
                        totalDuration
                    )}\`\n` +
                    `• Average Plays per Song: \`${(
                        totalPlays / Math.max(uniqueSongs, 1)
                    ).toFixed(1)}\`\n\n` +
                    `**👑 Top Artists**\n` +
                    (topArtists.length > 0
                        ? topArtists
                            .map(
                                (artist, i) =>
                                    `${["🥇", "🥈", "🥉"][i]} ${artist}`
                            )
                            .join("\n")
                        : "No artists found yet!") +
                    `\n\n**📈 Top 10 Most Played Tracks**\n\n${songList || "No tracks played yet!"
                    }`
                )
                .setFooter({
                    text: `Stats generated • ${new Date().toLocaleDateString()}`,
                    iconURL: client.user?.displayAvatarURL(),
                })
                .setTimestamp();

            if (subcommand === "guild") {
                embed.addFields({
                    name: "🎧 Server Activity",
                    value: `This server has listened to ${validSongs.length} unique tracks across all members!`,
                    inline: false,
                });
            }
            if (subcommand === "global") {
                embed.addFields({
                    name: "🌍 Global Reach",
                    value: "These statistics are aggregated from music lovers across multiple servers!",
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            client.logger.error(`Error in music chart command: ${error}`);
            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        `An error occurred while generating music statistics, please try again later!`,
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

export default musicChartCommand;
