import discord from "discord.js";
import DJRoleService from "../../../utils/music/dj_role_service";
import { MusicResponseHandler } from "../../../utils/music/embed_template";

export const handleRemoveSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
        const user = interaction.options.getUser("user");

        const guildData = await djService.getConfig(guildId);
        if (!guildData) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to retrieve DJ role configuration"
                    )
                ]
            });
        }

        if (!guildData.dj.enabled) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "The DJ role system is not enabled"
                    )
                ]
            });
        }

        if (!user && (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId)) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "There is no current DJ to remove"
                    )
                ]
            });
        }

        const success = await djService.removeDJRole(guildId, user?.id || null);

        if (!success) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to remove the DJ role. Please check bot permissions and try again."
                    )
                ]
            });
        }

        await interaction.editReply({
            embeds: [
                new discord.EmbedBuilder()
                    .setColor(discord.Colors.Green)
                    .setTitle("🎧 DJ Role Removed")
                    .setDescription(`Successfully removed the DJ role from ${user ? user.toString() : "the current DJ"}`)
                    .setFooter({ text: `Removed by ${interaction.user.tag}` })
                    .setTimestamp()
            ]
        });
    } catch (error) {
        client.logger.error(`[DJ_ROLE] Error in remove command: ${error}`);
        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "An error occurred while removing the DJ role"
                )
            ]
        });
    }
};