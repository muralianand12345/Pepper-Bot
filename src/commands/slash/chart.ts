import discord from "discord.js";
import Formatter from "../../utils/format";
import MusicDB from "../../utils/music/music_db";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { SlashCommand } from "../../types";

const musicChartCommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("chart")
        .setDescription("View music listening charts and statistics")
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
        ),

    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();
            let data;
            let title = "";
            let description = "";
            let targetUser = interaction.user;

            switch (subcommand) {
                case "personal":
                    data = await MusicDB.getUserMusicHistory(
                        interaction.user.id
                    );
                    title = `${interaction.user.username}'s Music Journey`;
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
                    title = `${
                        interaction.guild?.name || "Server"
                    }'s Musical Adventure`;
                    break;

                case "user":
                    targetUser = interaction.options.getUser("target")!;
                    if (!targetUser) {
                        throw new Error("User not found");
                    }
                    data = await MusicDB.getUserMusicHistory(targetUser.id);
                    title = `${targetUser.username}'s Music Collection`;
                    break;
            }

            if (!data || !data.songs || data.songs.length === 0) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            "🎵 No music history found!"
                        ),
                    ],
                });
            }

            // Advanced statistics calculations
            const totalPlays = data.songs.reduce(
                (sum, song) => sum + song.played_number,
                0
            );
            const uniqueSongs = data.songs.length;
            const topSongs = data.songs
                .sort((a, b) => b.played_number - a.played_number)
                .slice(0, 10);

            // Calculate favorite artists
            const artistStats = data.songs.reduce((acc, song) => {
                acc[song.author] = (acc[song.author] || 0) + song.played_number;
                return acc;
            }, {} as Record<string, number>);

            const topArtists = Object.entries(artistStats)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([artist, plays]) => `${artist} (\`${plays}\` plays)`);

            // Calculate total listening time
            const totalDuration = data.songs.reduce(
                (sum, song) => sum + song.duration * song.played_number,
                0
            );

            // Create the chart visualization
            const maxPlays = topSongs[0].played_number;
            const barLength = 15;

            const songList = topSongs
                .map((song, index) => {
                    const bars = Math.round(
                        (song.played_number / maxPlays) * barLength
                    );
                    const barDisplay =
                        "▰".repeat(bars) + "▱".repeat(barLength - bars);
                    const percentage = (
                        (song.played_number / totalPlays) *
                        100
                    ).toFixed(1);

                    return `\`${(index + 1)
                        .toString()
                        .padStart(
                            2,
                            "0"
                        )}\` ${barDisplay} **${Formatter.truncateText(
                        song.title,
                        30
                    )}**\n┗ by *${song.author}* • \`${
                        song.played_number
                    }\` plays • ${percentage}%`;
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
                    `Dive into the musical journey of a passionate listener!\n\n` +
                        `**📊 Overview Statistics**\n` +
                        `• Total Plays: \`${totalPlays}\` tracks played\n` +
                        `• Unique Songs: \`${uniqueSongs}\` different tracks\n` +
                        `• Total Listening Time: \`${Formatter.msToTime(
                            totalDuration
                        )}\`\n` +
                        `• Average Plays per Song: \`${(
                            totalPlays / uniqueSongs
                        ).toFixed(1)}\`\n\n` +
                        `**👑 Top Artists**\n` +
                        topArtists
                            .map(
                                (artist, i) =>
                                    `${["🥇", "🥈", "🥉"][i]} ${artist}`
                            )
                            .join("\n") +
                        `\n\n**📈 Top 10 Most Played Tracks**\n\n${songList}`
                )
                .setFooter({
                    text: `Stats generated • ${new Date().toLocaleDateString()}`,
                    iconURL: client.user?.displayAvatarURL(),
                })
                .setTimestamp();

            if (subcommand === "guild") {
                embed.addFields({
                    name: "🎧 Server Activity",
                    value: `This server has a vibrant music community with ${data.songs.length} tracks played across all members!`,
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        `An error occurred while generating music statistics: ${error}`
                    ),
                ],
            });
        }
    },
};

export default musicChartCommand;
