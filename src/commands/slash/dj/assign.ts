import discord from "discord.js";
import DJRoleService from "../../../utils/music/dj_role_service";
import { MusicResponseHandler } from "../../../utils/music/embed_template";

export const handleAssignSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
        const user = interaction.options.getUser("user", true);
        const duration = interaction.options.getInteger("duration");

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
                        "The DJ role system is not enabled. Please use `/dj setup` first."
                    )
                ]
            });
        }

        const durationMs = duration ? duration * 3600000 : null;

        const success = await djService.assignDJRole(
            guildId,
            user.id,
            user.username,
            durationMs
        );

        if (!success) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to assign the DJ role. Please check bot permissions and try again."
                    )
                ]
            });
        }

        const updatedGuildData = await djService.getConfig(guildId);
        if (!updatedGuildData || !updatedGuildData.dj.users.currentDJ || !updatedGuildData.dj.users.currentDJ.expiresAt) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to retrieve updated DJ information"
                    )
                ]
            });
        }

        const expiryTime = Math.floor(updatedGuildData.dj.users.currentDJ.expiresAt.getTime() / 1000);

        await interaction.editReply({
            embeds: [
                new discord.EmbedBuilder()
                    .setColor(discord.Colors.Green)
                    .setTitle("🎧 DJ Role Assigned")
                    .setDescription(`Successfully assigned the DJ role to ${user.toString()}`)
                    .addFields({
                        name: "Duration",
                        value: `Role will expire at <t:${expiryTime}:f> (<t:${expiryTime}:R>)`
                    })
                    .setFooter({ text: `Assigned by ${interaction.user.tag}` })
                    .setTimestamp()
            ]
        });
    } catch (error) {
        client.logger.error(`[DJ_ROLE] Error in assign command: ${error}`);
        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "An error occurred while assigning the DJ role"
                )
            ]
        });
    }
};