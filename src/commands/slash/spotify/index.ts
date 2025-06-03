import discord from "discord.js";
import { MusicResponseHandler } from "../../../core/music";
import { SlashCommand } from "../../../types";

import { handleInfoSubcommand } from "./info";
import { handleConfigSubcommand } from "./config";


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

export default spotifyCommand;