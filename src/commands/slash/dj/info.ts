import discord from "discord.js";
import { MusicResponseHandler, DJRoleService } from "../../../core/music";

export const handleInfoSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
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

        const embed = new discord.EmbedBuilder()
            .setTitle("🎧 DJ Role Information")
            .setColor(discord.Colors.Purple)
            .addFields({
                name: "Status",
                value: guildData.dj.enabled ? "Enabled" : "Disabled"
            });

        if (guildData.dj.enabled) {
            if (!guildData.dj.roleId) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "The DJ role is not configured. Please use `/dj setup` to configure it."
                        )
                    ]
                });
            }
            const role = interaction.guild?.roles.cache.get(guildData.dj.roleId);

            embed.addFields({
                name: "Role",
                value: role ? role.toString() : "Not configured"
            });

            embed.addFields({
                name: "Settings",
                value: `• Auto-assign: ${guildData.dj.auto.assign ? "Yes" : "No"}
• Role duration: ${Math.floor(guildData.dj.auto.timeout / 3600000)} hours`
            });

            if (guildData.dj.users.currentDJ &&
                guildData.dj.users.currentDJ.userId &&
                guildData.dj.users.currentDJ.assignedAt &&
                guildData.dj.users.currentDJ.expiresAt) {

                const assignedTimestamp = Math.floor(guildData.dj.users.currentDJ.assignedAt.getTime() / 1000);
                const expiryTimestamp = Math.floor(guildData.dj.users.currentDJ.expiresAt.getTime() / 1000);

                embed.addFields({
                    name: "Current DJ",
                    value: `• User: <@${guildData.dj.users.currentDJ.userId}>
• Assigned: <t:${assignedTimestamp}:R>
• Expires: <t:${expiryTimestamp}:R> (<t:${expiryTimestamp}:f>)`
                });
            } else {
                embed.addFields({
                    name: "Current DJ",
                    value: "No DJ currently assigned"
                });
            }

            if (guildData.dj.users.previousDJs && guildData.dj.users.previousDJs.length > 0) {
                const previousDJs = guildData.dj.users.previousDJs
                    .slice(-3)
                    .reverse()
                    .map(dj => `• <@${dj.userId}> (${new Date(dj.assignedAt).toLocaleDateString()} - ${new Date(dj.expiresAt).toLocaleDateString()})`)
                    .join('\n');

                embed.addFields({
                    name: "Previous DJs (Last 3)",
                    value: previousDJs
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        client.logger.error(`[DJ_ROLE] Error in info command: ${error}`);
        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "An error occurred while retrieving DJ information"
                )
            ]
        });
    }
};