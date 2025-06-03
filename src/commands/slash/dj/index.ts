import discord from "discord.js";
import DJRoleService from "../../../utils/music/dj_role_service";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { SlashCommand } from "../../../types";

import { handleSetupSubcommand } from "./setup";
import { handleAssignSubcommand } from "./assign";
import { handleRemoveSubcommand } from "./remove";
import { handleInfoSubcommand } from "./info";
import { handleActiveSubcommand } from "./active";

const djRoleCommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("dj")
        .setDescription("Manage the DJ role for music commands")
        .setContexts(discord.InteractionContextType.Guild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("setup")
                .setDescription("Set up or update DJ role settings")
                .addBooleanOption(option =>
                    option
                        .setName("enabled")
                        .setDescription("Enable or disable the DJ role system")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription("Select an existing role to use as the DJ role")
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName("auto_assign")
                        .setDescription("Automatically assign the DJ role based on activity")
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option
                        .setName("timeout")
                        .setDescription("How long a DJ role should last (in hours)")
                        .setMinValue(1)
                        .setMaxValue(168)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("assign")
                .setDescription("Manually assign the DJ role to a user")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("User to assign the DJ role to")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("duration")
                        .setDescription("Duration of the role in hours")
                        .setMinValue(1)
                        .setMaxValue(168)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Remove the DJ role from a user")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("User to remove the DJ role from (defaults to current DJ)")
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("info")
                .setDescription("Show information about the current DJ and settings")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("active")
                .setDescription("Show the most active music listeners")
                .addIntegerOption(option =>
                    option
                        .setName("limit")
                        .setDescription("Number of users to show")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )
        ),

    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {

        if (!client.config.music.enabled) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Music is currently disabled"
                    )
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        if (!client.config.bot.features?.dj_role?.enabled) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "The DJ role feature is not enabled on this server"
                    )
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        if (!interaction.guild) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "This command can only be used in a server"
                    )
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const djService = new DJRoleService(client);

        if (subcommand === "setup" || subcommand === "assign" || subcommand === "remove") {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasPermission =
                member.permissions.has(discord.PermissionFlagsBits.Administrator) ||
                member.permissions.has(discord.PermissionFlagsBits.ManageRoles);

            if (!hasPermission) {
                return await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "You need Administrator or Manage Roles permission to use this command"
                        )
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        }

        switch (subcommand) {
            case "setup":
                await handleSetupSubcommand(interaction, client, djService);
                break;
            case "assign":
                await handleAssignSubcommand(interaction, client, djService);
                break;
            case "remove":
                await handleRemoveSubcommand(interaction, client, djService);
                break;
            case "info":
                await handleInfoSubcommand(interaction, client, djService);
                break;
            case "active":
                await handleActiveSubcommand(interaction, client, djService);
                break;
        }
    }
};

export default djRoleCommand;