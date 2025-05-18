import discord from "discord.js";
import AutoplayManager from "../../utils/music/autoplay_manager";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { SlashCommand } from "../../types";

const autoplaycommand: SlashCommand = {
    cooldown: 5,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("autoplay")
        .setDescription("Toggle smart autoplay based on your music preferences")
        .setContexts(discord.InteractionContextType.Guild)
        .addBooleanOption((option) =>
            option
                .setName("enabled")
                .setDescription("Enable or disable autoplay")
                .setRequired(true)
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
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        const player = client.manager.get(interaction.guild?.id || "");
        if (!player) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "No music is currently playing"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        const validator = new VoiceChannelValidator(client, interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) {
                return await interaction.reply({
                    embeds: [embed],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        }

        await interaction.deferReply();

        try {
            const autoplayEnabled = interaction.options.getBoolean("enabled") || false;

            const autoplayManager = AutoplayManager.getInstance(
                player.guildId,
                player,
                client
            );

            if (autoplayEnabled) {
                autoplayManager.enable(interaction.user.id);
                const embed = new MusicResponseHandler(client).createSuccessEmbed(
                    "🎵 Smart Autoplay is now **enabled**\n\n" +
                    "When the queue is empty, I'll automatically add songs based on your music preferences."
                );

                await interaction.editReply({
                    embeds: [embed],
                });
            } else {
                autoplayManager.disable();
                const embed = new MusicResponseHandler(client).createInfoEmbed(
                    "⏹️ Autoplay is now **disabled**\n\n" +
                    "Playback will stop when the queue is empty."
                );

                await interaction.editReply({
                    embeds: [embed],
                });
            }
        } catch (error) {
            client.logger.error(`[AUTOPLAY] Command error: ${error}`);

            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while toggling autoplay.",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
            });
        }
    },
};

export default autoplaycommand;