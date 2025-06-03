import discord from "discord.js";
import DJRoleService from "../../../utils/music/dj_role_service";
import { MusicResponseHandler } from "../../../utils/music/embed_template";

export const handleActiveSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
        const limit = interaction.options.getInteger("limit") || 5;
        const activeUsers = await djService.getMostActiveUsers(guildId);

        if (!activeUsers || activeUsers.length === 0) {
            return await interaction.editReply({
                embeds: [
                    new discord.EmbedBuilder()
                        .setColor(discord.Colors.Blue)
                        .setTitle("🎵 Active Music Listeners")
                        .setDescription("No active music listeners found in the past 7 days")
                ]
            });
        }

        const userList = activeUsers
            .slice(0, limit)
            .map((user, index) =>
                `${index + 1}. <@${user.userId}> - ${user.activity} songs played`
            )
            .join('\n');

        await interaction.editReply({
            embeds: [
                new discord.EmbedBuilder()
                    .setColor(discord.Colors.Blue)
                    .setTitle("🎵 Most Active Music Listeners")
                    .setDescription(
                        "Based on songs played in the past 7 days:\n\n" + userList
                    )
                    .setFooter({ text: "Activity includes both bot playback and Spotify listening" })
                    .setTimestamp()
            ]
        });
    } catch (error) {
        client.logger.error(`[DJ_ROLE] Error in active command: ${error}`);
        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "An error occurred while retrieving active listeners"
                )
            ]
        });
    }
};