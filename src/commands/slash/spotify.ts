import discord from "discord.js";
import music_user from "../../events/database/schema/music_user";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { SlashCommand } from "../../types";

const spotifyCommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("spotify")
        .setDescription("Configure Spotify presence tracking and get information")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("config")
                .setDescription("Configure your Spotify presence tracking settings")
                .addBooleanOption((option) =>
                    option
                        .setName("enabled")
                        .setDescription("Enable or disable Spotify presence tracking")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("info")
                .setDescription("Get information about Spotify presence tracking")
        ),

    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        try {
            if (!client.config.bot.features?.spotify_presence?.enabled) {
                return await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "Spotify presence tracking is currently disabled on this bot."
                        ),
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === "config") {
                await handleConfigSubcommand(interaction, client);
            } else if (subcommand === "info") {
                await handleInfoSubcommand(interaction, client);
            }
        } catch (error) {
            client.logger.error(`[SPOTIFY] Command error: ${error}`);
            await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while processing your request.",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }
    },
};

const handleConfigSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client
): Promise<void> => {
    const userId = interaction.user.id;
    const enabled = interaction.options.getBoolean("enabled", true);

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

    try {
        let userDoc = await music_user.findOne({ userId });
        let previousSetting = true;

        if (!userDoc) {
            userDoc = new music_user({
                userId,
                spotify_presence: enabled,
                songs: []
            });
        } else {
            previousSetting = userDoc.spotify_presence;
            userDoc.spotify_presence = enabled;
        }

        await userDoc.save();

        if (previousSetting === enabled) {
            const embed = new discord.EmbedBuilder()
                .setColor(enabled ? "#1DB954" : "#747f8d")
                .setTitle("Spotify Presence Settings")
                .setDescription(
                    enabled
                        ? "✅ Spotify presence tracking is already enabled for your account."
                        : "❌ Spotify presence tracking is already disabled for your account."
                )
                .addFields([
                    {
                        name: "What does this mean?",
                        value: enabled
                            ? "Your Spotify listening activity will continue to be tracked to provide personalized music recommendations."
                            : "Your Spotify listening activity will not be tracked."
                    }
                ])
                .setFooter({
                    text: `Your preference remains unchanged`,
                    iconURL: client.user?.displayAvatarURL()
                });

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const embed = new discord.EmbedBuilder()
            .setColor(enabled ? "#1DB954" : "#747f8d")
            .setTitle("Spotify Presence Settings Updated")
            .setDescription(
                enabled
                    ? "✅ Spotify presence tracking has been **enabled** for your account."
                    : "❌ Spotify presence tracking has been **disabled** for your account."
            )
            .addFields([
                {
                    name: "What does this mean?",
                    value: enabled
                        ? "Your Spotify listening activity will now be tracked to enhance music recommendations and autoplay features. When you listen to songs on Spotify, they'll be added to your music history."
                        : "Your Spotify listening activity will no longer be tracked. Songs you listen to on Spotify won't be added to your music history."
                },
                {
                    name: "Privacy Note",
                    value: "Your data is only used to improve your experience with this bot. It's never shared with third parties."
                }
            ])
            .setFooter({
                text: `You can change this setting anytime with /spotify config`,
                iconURL: client.user?.displayAvatarURL()
            });

        await interaction.editReply({ embeds: [embed] });

        client.logger.info(`[SPOTIFY_CONFIG] User ${interaction.user.tag} (${userId}) ${enabled ? 'enabled' : 'disabled'} Spotify presence tracking`);

    } catch (error) {
        client.logger.error(`[SPOTIFY_CONFIG] Database error: ${error}`);
        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "Failed to update your preferences. Please try again later.",
                    true
                ),
            ],
            components: [
                new MusicResponseHandler(client).getSupportButton(),
            ]
        });
    }
};

const handleInfoSubcommand = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client
): Promise<void> => {
    try {
        const userId = interaction.user.id;
        const userDoc = await music_user.findOne({ userId });
        const currentSetting = userDoc?.spotify_presence ?? true;

        const embed = new discord.EmbedBuilder()
            .setColor("#1DB954")
            .setTitle("Spotify Presence Tracking")
            .setDescription(
                "Spotify presence tracking enhances your music experience by automatically adding songs you listen to on Spotify to your personal music history."
            )
            .addFields([
                {
                    name: "Why is this useful?",
                    value: "It's used to add songs to your database as you listen on Spotify. This enables better song suggestions and personalized autoplay features tailored to your music taste."
                },
                {
                    name: "Is my data private?",
                    value: "Yes, your Spotify listening data is only used for enhancing your experience with this bot. It's never shared with third parties."
                },
                {
                    name: "Your current setting",
                    value: currentSetting
                        ? "✅ **Enabled** - Your Spotify listening activity is being tracked."
                        : "❌ **Disabled** - Your Spotify listening activity is not being tracked."
                },
                {
                    name: "How to change your setting",
                    value: "Use `/spotify config enabled:true` to enable tracking or `/spotify config enabled:false` to disable it."
                }
            ])
            .setFooter({
                text: "You can change this setting anytime",
                iconURL: client.user?.displayAvatarURL()
            });

        const components = new discord.ActionRowBuilder<discord.ButtonBuilder>()
            .addComponents(
                new discord.ButtonBuilder()
                    .setLabel("Support Server")
                    .setStyle(discord.ButtonStyle.Link)
                    .setURL("https://discord.gg/XzE9hSbsNb")
            );

        await interaction.reply({
            embeds: [embed],
            components: [components],
            flags: discord.MessageFlags.Ephemeral,
        });
    } catch (error) {
        client.logger.error(`[SPOTIFY_INFO] Error: ${error}`);
        await interaction.reply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "Failed to retrieve your Spotify tracking information.",
                    true
                ),
            ],
            components: [
                new MusicResponseHandler(client).getSupportButton(),
            ],
            flags: discord.MessageFlags.Ephemeral,
        });
    }
};

export default spotifyCommand;