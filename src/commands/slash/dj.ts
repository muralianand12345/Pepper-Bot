import discord from "discord.js";
import DJRoleService from "../../utils/music/dj_role_service";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { SlashCommand } from "../../types";

const handleSetupSubcommand = async (
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

        // Get current configuration
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

        // Build update object with specified options
        const updateData: any = {
            enabled: enabled
        };

        // Only add the fields that were specified
        if (autoAssign !== null) {
            updateData.auto = {
                ...guildData.dj.auto,
                assign: autoAssign
            };
        }

        if (timeout) {
            updateData.auto = {
                ...updateData.auto || guildData.dj.auto,
                timeout: timeout * 3600000 // Convert hours to milliseconds
            };
        }

        if (role) {
            updateData.roleId = role.id;
        }

        // Update configuration
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

        // Send success response
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

        // If enabled, try to assign a DJ if none exists
        if (enabled && (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId)) {
            // Find active users
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

const handleAssignSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
        const user = interaction.options.getUser("user", true);
        const duration = interaction.options.getInteger("duration");

        // Get guild configuration
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

        // Check if DJ role system is enabled
        if (!guildData.dj.enabled) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "The DJ role system is not enabled. Please use `/dj setup` first."
                    )
                ]
            });
        }

        // Convert duration to milliseconds or use default
        const durationMs = duration ? duration * 3600000 : null; // Convert hours to ms

        // Assign the DJ role
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

        // Recalculate expiry time based on updated guild data
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

        // Send success message
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

const handleRemoveSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
        const user = interaction.options.getUser("user");

        // Get guild configuration
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

        // Check if DJ role system is enabled
        if (!guildData.dj.enabled) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "The DJ role system is not enabled"
                    )
                ]
            });
        }

        // If no user specified, check if there is a current DJ
        if (!user && (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId)) {
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "There is no current DJ to remove"
                    )
                ]
            });
        }

        // Remove the DJ role
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

        // Send success message
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

const handleInfoSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;

        // Get guild configuration
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

        // Create embed with DJ information
        const embed = new discord.EmbedBuilder()
            .setTitle("🎧 DJ Role Information")
            .setColor(discord.Colors.Purple)
            .addFields({
                name: "Status",
                value: guildData.dj.enabled ? "Enabled" : "Disabled"
            });

        // Add role information if enabled
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

            // Add current DJ information
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

            // Add previous DJs if available
            if (guildData.dj.users.previousDJs && guildData.dj.users.previousDJs.length > 0) {
                const previousDJs = guildData.dj.users.previousDJs
                    .slice(-3) // Get the last 3
                    .reverse() // Most recent first
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

const handleActiveSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    djService: DJRoleService
) => {
    await interaction.deferReply();

    try {
        const guildId = interaction.guildId!;
        const limit = interaction.options.getInteger("limit") || 5;

        // Get most active users
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

        // Format active users list
        const userList = activeUsers
            .slice(0, limit)
            .map((user, index) =>
                `${index + 1}. <@${user.userId}> - ${user.activity} songs played`
            )
            .join('\n');

        // Create and send embed
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
                        .setMaxValue(168) // 1 week
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
                        .setMaxValue(168) // 1 week
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

        // Check if the interaction is in a guild
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

        // Check for required permissions for admin commands
        if (subcommand === "setup" || subcommand === "assign" || subcommand === "remove") {
            // For configuration commands, check for admin or manage roles permission
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