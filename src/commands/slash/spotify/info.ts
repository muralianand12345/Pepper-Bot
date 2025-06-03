import discord from "discord.js";
import music_user from "../../../events/database/schema/music_user";
import { MusicResponseHandler } from "../../../core/music";


export const handleInfoSubcommand = async (
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