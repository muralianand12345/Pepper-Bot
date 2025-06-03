import discord from "discord.js";
import DJRoleService from "../../../utils/music/dj_role_service";
import { MusicResponseHandler } from "../../../utils/music/embed_template";

export const handleSetupSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
        const enabled = interaction.options.getBoolean("enabled", true);
        const autoAssign = interaction.options.getBoolean("auto_assign");
        const timeout = interaction.options.getInteger("timeout");
        const role = interaction.options.getRole("role");

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

        const updateData: any = {
            enabled: enabled
        };

        if (autoAssign !== null) {
            updateData.auto = {
                ...guildData.dj.auto,
                assign: autoAssign
            };
        }

        if (timeout) {
            updateData.auto = {
                ...updateData.auto || guildData.dj.auto,
                timeout: timeout * 3600000
            };
        }

        if (role) {
            updateData.roleId = role.id;
        }

        const result = await djService.updateConfig(guildId, updateData);
        if (!result) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to update DJ role configuration"
                    )
                ]
            });
        }

        const embed = new discord.EmbedBuilder()
            .setColor(discord.Colors.Green)
            .setTitle("🎧 DJ Role Setup Updated")
            .setDescription(`The DJ role system is now ${enabled ? "**enabled**" : "**disabled**"}`)
            .addFields([
                {
                    name: "Settings",
                    value: `
• **Auto-assign:** ${updateData.auto?.assign ?? guildData.dj.auto.assign ? "Yes" : "No"}
• **Role duration:** ${Math.floor((updateData.auto?.timeout ?? guildData.dj.auto.timeout) / 3600000)} hours
${role ? `• **Role:** ${role.toString()}` : ""}
                    `
                }
            ])
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        if (enabled && (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId)) {
            const activeUsers = await djService.getMostActiveUsers(guildId);

            if (activeUsers.length > 0) {
                const newDJ = activeUsers[0];
                const success = await djService.assignDJRole(
                    guildId,
                    newDJ.userId,
                    newDJ.username
                );

                if (success) {
                    await interaction.followUp({
                        embeds: [
                            new discord.EmbedBuilder()
                                .setColor(discord.Colors.Purple)
                                .setTitle("🎧 DJ Role Auto-Assigned")
                                .setDescription(`Based on music activity, <@${newDJ.userId}> has been assigned as the server DJ.`)
                        ]
                    });
                }
            }
        }
    } catch (error) {
        client.logger.error(`[DJ_ROLE] Error in setup command: ${error}`);
        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "An error occurred while setting up the DJ role"
                )
            ]
        });
    }
};