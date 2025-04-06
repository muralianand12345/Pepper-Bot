import discord from "discord.js";
import music_guild from "../../events/database/schema/music_guild";
import { MusicResponseHandler, MusicChannelManager } from "../../utils/music/embed_template";
import { SlashCommand } from "../../types";

const setupCommand: SlashCommand = {
    cooldown: 10,
    dj: true,
    data: new discord.SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup music bot in the server")
        .setContexts(discord.InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName("prefix")
                .setDescription("Prefix for the music bot")
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName("music_channel")
                .setDescription("Music channel for the bot")
                .setRequired(false)
                .addChannelTypes(discord.ChannelType.GuildText)
        ),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
        // Check if music is enabled
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

        if (client.config.bot.command.disable_message) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "This command is disabled"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        // Validate guild context
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

        // Get input options
        const prefix = interaction.options.getString("prefix");
        const musicChannel = interaction.options.getChannel("music_channel");

        // If no options provided, show current configuration
        if (!prefix && !musicChannel) {
            return await showCurrentConfig(interaction, client);
        }

        await interaction.deferReply();

        try {
            // Find or create guild data
            let guildData = await music_guild.findOne({ guildId: interaction.guild.id });

            if (!guildData) {
                // Create new guild entry if it doesn't exist
                guildData = new music_guild({
                    guildId: interaction.guild.id,
                    prefix: client.config.bot.command.prefix,
                    songChannelId: null,
                    songs: []
                });
            }

            // Update prefix if provided
            if (prefix) {
                guildData.prefix = prefix;
            }

            // Update music channel if provided
            if (musicChannel) {
                guildData.songChannelId = musicChannel.id;
                // Create music channel embed
                const musicChannelManager = new MusicChannelManager(client);
                const music_pannel_message = await musicChannelManager.createMusicEmbed(musicChannel);
                guildData.musicPannelId = music_pannel_message?.id || null;
                client.logger.info(
                    `[SETUP] Initialized music channel embed in #${musicChannel.name} (${musicChannel.id})`
                );
            }

            // Save changes to database
            await guildData.save();

            // Create success embed
            const embed = new discord.EmbedBuilder()
                .setColor("#43b581") // Discord green
                .setTitle("✅ Bot Configuration Updated")
                .setDescription("Setup completed successfully!")
                .addFields([
                    {
                        name: "Prefix",
                        value: `\`${guildData.prefix}\``,
                        inline: true
                    },
                    {
                        name: "Music Channel",
                        value: guildData.songChannelId ? `<#${guildData.songChannelId}>` : "Not set",
                        inline: true
                    }
                ])
                .setFooter({
                    text: `Setup by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log the setup action
            client.logger.info(
                `[SETUP] Updated configuration for guild ${interaction.guild.name} (${interaction.guild.id}): ` +
                `Prefix: ${guildData.prefix}, Music Channel: ${guildData.songChannelId}`
            );
        } catch (error) {
            client.logger.error(`[SETUP] Error updating configuration: ${error}`);

            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while updating the configuration. Please try again later.",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
            });
        }
    }
};

const showCurrentConfig = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client
): Promise<void> => {
    await interaction.deferReply();

    try {
        // Get guild data
        const guildData = await music_guild.findOne({ guildId: interaction.guild?.id });

        // Default config if no guild data found
        const prefix = guildData?.prefix || client.config.bot.command.prefix;
        const songChannelId = guildData?.songChannelId || null;

        // Create info embed
        const embed = new discord.EmbedBuilder()
            .setColor("#5865f2") // Discord blurple
            .setTitle("⚙️ Current Bot Configuration")
            .addFields([
                {
                    name: "Prefix",
                    value: `\`${prefix}\``,
                    inline: true
                },
                {
                    name: "Music Channel",
                    value: songChannelId ? `<#${songChannelId}>` : "Not set",
                    inline: true
                }
            ])
            .setDescription(
                "To update settings, use the command with options:\n" +
                `\`/setup prefix:<prefix> music_channel:#channel\``
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        client.logger.error(`[SETUP] Error retrieving configuration: ${error}`);

        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "An error occurred while retrieving the configuration.",
                    true
                ),
            ],
            components: [
                new MusicResponseHandler(client).getSupportButton(),
            ],
        });
    }
};

export default setupCommand;