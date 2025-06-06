import discord from "discord.js";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator, MusicPlayerValidator } from "../../utils/music/music_validations";
import { SlashCommand } from "../../types";

const skipcommand: SlashCommand = {
    cooldown: 2,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip the current song or skip to a specific time")
        .setContexts(discord.InteractionContextType.Guild)
        .addIntegerOption((option) =>
            option
                .setName("time")
                .setDescription("Skip to a specific time in seconds")
                .setRequired(false)
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
        if (!player)
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "No music is currently playing"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });

        const validator = new VoiceChannelValidator(client, interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid)
                return await interaction.reply({
                    embeds: [embed],
                    flags: discord.MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply();

        const time = interaction.options.getInteger("time") || 0;
        if (time > 0) {
            player.seek(time * 1000);
            return await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        `Skipped to ${time} seconds`
                    ),
                ],
            });
        } else {
            const music_validator = new MusicPlayerValidator(client, player);
            const [queueValid, queueError] =
                await music_validator.validateQueueSize(1);
            if (!queueValid && queueError) {
                await interaction.editReply({
                    embeds: [queueError],
                });
                return;
            }

            player.stop(1);
            if (player.queue.size === 0) {
                player.destroy();
            }

            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        "Skipped the current song!"
                    ),
                ],
            });
        }
    },
};

export default skipcommand;
