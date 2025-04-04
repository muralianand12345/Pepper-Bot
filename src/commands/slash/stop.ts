import discord from "discord.js";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { SlashCommand } from "../../types";

const stopcommand: SlashCommand = {
    cooldown: 5,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop all music playback")
        .setContexts(discord.InteractionContextType.Guild),
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

        player.destroy();
        await interaction.reply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "Music playback has been stopped"
                ),
            ],
        });
    },
};

export default stopcommand;
