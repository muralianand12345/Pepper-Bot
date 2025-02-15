import discord from "discord.js";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { SlashCommand, INodeOption } from "../../types";

/**
 * Configuration constants for node management
 * @const {Object} CONFIG
 * @property {string} ERROR_SEARCH_TEXT - Error message for failed node fetching
 */
const CONFIG = {
    ERROR_SEARCH_TEXT: "Error fetching Lavalink nodes",
} as const;

/**
 * Command to manage Lavalink nodes for music playback
 * Allows users to change nodes manually or automatically when experiencing lag
 * @type {SlashCommand}
 */
const nodeCommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("node")
        .setDescription("Manage lavalink nodes")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("change")
                .setDescription(
                    "Change lavalink nodes. (Change if music lagging)"
                )
                .addStringOption((option) =>
                    option
                        .setName("lavalink_node")
                        .setDescription("Select a node")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("type")
                        .setDescription("Select node change mode")
                        .setRequired(false)
                        .addChoices(
                            { name: "Auto Mode", value: "auto" },
                            { name: "Manual Mode", value: "manual" }
                        )
                )
        ),

    /**
     * Handles autocomplete for Lavalink node selection
     * Provides a list of available nodes with their identifiers and hosts
     * @param {discord.AutocompleteInteraction} interaction - The autocomplete interaction
     * @param {discord.Client} client - Discord client instance
     * @returns {Promise<void>}
     */
    autocomplete: async (
        interaction: discord.AutocompleteInteraction,
        client: discord.Client
    ): Promise<void> => {
        const focused = interaction.options.getFocused(true);

        if (focused.name !== "lavalink_node") return;

        try {
            const nodes: INodeOption[] = client.manager.nodes.map((node) => ({
                name: `${node.options.identifier} (${node.options.host})`,
                value: node.options.identifier || "Unknown Node",
            }));

            const filteredOptions = nodes.filter((option) =>
                option.name.toLowerCase().includes(focused.value.toLowerCase())
            );

            await interaction.respond(filteredOptions.slice(0, 25));
        } catch (error) {
            client.logger.error(
                `[NODE] Error fetching lavalink nodes: ${error}`
            );
            await interaction.respond([
                {
                    name: CONFIG.ERROR_SEARCH_TEXT,
                    value: CONFIG.ERROR_SEARCH_TEXT,
                },
            ]);
        }
    },

    /**
     * Executes the node change command
     * Validates the context and changes the Lavalink node either automatically or manually
     * @param {discord.ChatInputCommandInteraction} interaction - The command interaction
     * @param {discord.Client} client - Discord client instance
     * @returns {Promise<void>}
     */
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        // Early returns for disabled music and invalid subcommands
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

        if (interaction.options.getSubcommand() !== "change") return;

        // Validate node choice
        const nodeChoice =
            interaction.options.getString("lavalink_node") ||
            CONFIG.ERROR_SEARCH_TEXT;
        if (nodeChoice === CONFIG.ERROR_SEARCH_TEXT) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Please provide a valid node"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        // Get current player instance
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

        // Validate voice channel context
        const validator = new VoiceChannelValidator(client, interaction);
        const validationChecks = [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ];

        for (const check of validationChecks) {
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
            const nodeType = interaction.options.getString("type") || "manual";
            let updatedPlayer = null;

            if (nodeType === "auto") {
                updatedPlayer = await player.autoMoveNode();

                if (!updatedPlayer) {
                    return await interaction.editReply({
                        embeds: [
                            new MusicResponseHandler(client).createErrorEmbed(
                                "No suitable node found for auto-move. Try manual selection."
                            ),
                        ],
                    });
                }
            } else {
                try {
                    updatedPlayer = await player.moveNode(nodeChoice);
                } catch (error) {
                    return await interaction.editReply({
                        embeds: [
                            new MusicResponseHandler(client).createErrorEmbed(
                                `Failed to move to node ${nodeChoice}: ${error}`
                            ),
                        ],
                    });
                }
            }

            // Update the client's player reference with the new player
            if (updatedPlayer) {
                client.manager.players.set(
                    interaction.guild?.id || "",
                    updatedPlayer
                );
            }

            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        nodeType === "auto"
                            ? "Successfully moved to the best available node"
                            : `Successfully moved to node: ${nodeChoice}`
                    ),
                ],
            });
        } catch (error) {
            client.logger.error(`[NODE] Error changing node: ${error}`);
            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while changing nodes. Please try again."
                    ),
                ],
            });
        }
    },
};

export default nodeCommand;
