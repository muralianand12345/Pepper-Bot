import discord from "discord.js";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { SlashCommand } from "../../types";


/**
 * Slash command for skipping time or skip to next song
 * @type {SlashCommand}
 */
const autoplaycommand: SlashCommand = {
    cooldown: 2,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("autoplay")
        .setDescription("Toggle autoplay for the current playlist")
        .setContexts(discord.InteractionContextType.Guild)
        .addBooleanOption((option) =>
            option
                .setName("enabled")
                .setDescription("Enable or disable autoplay")
                .setRequired(true)
        ),

    /**
     * Executes the play command, handling music playback setup and validation
     * @param {discord.ChatInputCommandInteraction} interaction - Command interaction
     * @param {discord.Client} client - Discord client instance
     */
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

        const autoplayEnabled = interaction.options.getBoolean("enabled") || true;

        try {
            player.setAutoplay(autoplayEnabled, client.user || undefined);
        } catch (error) {
            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        'Failed to set autoplay'
                    ),
                ],
            });

            throw error;
        }

        const embed = new MusicResponseHandler(client).createSuccessEmbed(
            `Autoplay is now ${autoplayEnabled ? "enabled" : "disabled"}`
        );
        await interaction.editReply({
            embeds: [embed],
        });
    },
};

export default autoplaycommand;