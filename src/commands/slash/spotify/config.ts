import discord from "discord.js";
import music_user from "../../../events/database/schema/music_user";
import { MusicResponseHandler } from "../../../core/music";


export const handleConfigSubcommand = async (
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