import discord from "discord.js";
import { MusicResponseHandler, VoiceChannelValidator } from "../../../core/music";
import { SlashCommand } from "../../../types";

import { handleShowQueue } from "./show";
import { handleMoveInQueue } from "./move";
import { handleClearQueue } from "./clear";
import { handleShuffleQueue } from "./shuffle";
import { handleRemoveFromQueue } from "./remove";


const queuecommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("queue")
        .setDescription("Manage the music queue")
        .setContexts(discord.InteractionContextType.Guild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("show")
                .setDescription("Show the current music queue")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Remove a song from the queue")
                .addIntegerOption((option) =>
                    option
                        .setName("position")
                        .setDescription("Position of the song to remove")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("move")
                .setDescription("Move a song to a different position")
                .addIntegerOption((option) =>
                    option
                        .setName("from")
                        .setDescription("Current position of the song")
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("to")
                        .setDescription("New position for the song")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("clear")
                .setDescription("Clear all songs from the queue")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("shuffle")
                .setDescription("Shuffle the current queue")
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

        const subcommand = interaction.options.getSubcommand();
        const handlers = {
            show: handleShowQueue,
            remove: handleRemoveFromQueue,
            move: handleMoveInQueue,
            clear: handleClearQueue,
            shuffle: handleShuffleQueue,
        };

        await handlers[subcommand as keyof typeof handlers](
            interaction,
            client,
            player
        );
    },
};

export default queuecommand;