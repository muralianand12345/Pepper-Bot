import discord from "discord.js";
import magmastream from "magmastream";
import { SpotifyAutoComplete } from "../../utils/auto_search";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { handleSearchResult } from "../../utils/music/music_functions";
import { ConfigManager } from "../../utils/config";
import { SlashCommand, INodeOption } from "../../types";

// Load environment variables
const configManager = ConfigManager.getInstance();

/**
 * Configuration for music playback settings
 * @type {const}
 */
const CONFIG = {
    /** Error message for failed Lavalink node search */
    ERROR_SEARCH_TEXT: "Unable To Fetch Results",
    /** Default placeholder text for search input */
    DEFAULT_SEARCH_TEXT: "Please enter a song name or url",
    /** Default player configuration options */
    PLAYER_OPTIONS: {
        volume: 50,
        selfDeafen: true,
    },
} as const;

/**
 * Slash command for playing music in voice channels
 * @type {SlashCommand}
 */
const playcommand: SlashCommand = {
    cooldown: 5,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song via song name or url")
        .setContexts(discord.InteractionContextType.Guild)
        .addStringOption((option) =>
            option
                .setName("song")
                .setDescription("Song Name/URL")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption((option) =>
            option
                .setName("lavalink_node")
                .setDescription("Lavalink to play the song (Optional)")
                .setRequired(false)
                .setAutocomplete(true)
        ),

    /**
     * Handles song name autocomplete suggestions
     * @param {discord.AutocompleteInteraction} interaction - Autocomplete interaction
     * @param {discord.Client} client - Discord client instance
     * @returns {Promise<void>}
     */
    autocomplete: async (
        interaction: discord.AutocompleteInteraction,
        client: discord.Client
    ): Promise<void> => {
        const focused = interaction.options.getFocused(true);

        try {
            let suggestions;

            if (focused.name === "lavalink_node") {
                const nodes: INodeOption[] = client.manager.nodes
                    .filter((node: magmastream.Node) => node.connected == true)
                    .map((node: magmastream.Node) => ({
                        name: `${node.options.identifier} (${node.options.host})`,
                        value: node.options.identifier || "Unknown Node",
                    }));

                suggestions = nodes.filter((option: INodeOption) =>
                    option.name
                        .toLowerCase()
                        .includes(focused.value.toLowerCase())
                );
            } else if (focused.name === "song") {
                if (!focused.value) {
                    suggestions = [
                        {
                            name: CONFIG.DEFAULT_SEARCH_TEXT.slice(0, 100),
                            value: CONFIG.DEFAULT_SEARCH_TEXT,
                        },
                    ];
                } else {
                    focused.value = focused.value.split("?")[0].split("#")[0];

                    const isSpotifyLink = focused.value.match(/^(https:\/\/open\.spotify\.com\/|spotify:)/i);
                    const isStringWithoutHttp = focused.value.match(/^(?!https?:\/\/)([a-zA-Z0-9\s]+)$/);
                    if (isSpotifyLink || isStringWithoutHttp) {
                        suggestions = await new SpotifyAutoComplete(
                            client,
                            configManager.getSpotifyClientId(),
                            configManager.getSpotifyClientSecret()
                        ).getSuggestions(focused.value);
                    } else {
                        suggestions = [
                            {
                                name: `${focused.value.slice(0, 80)}`,
                                value: focused.value,
                            },
                        ];
                    }
                }
            }

            await interaction.respond(suggestions || []);
        } catch (error) {
            client.logger.error(`[NODE_PLAY] Autocomplete error: ${error}`);
            await interaction.respond([
                {
                    name: CONFIG.ERROR_SEARCH_TEXT.slice(0, 100),
                    value: CONFIG.ERROR_SEARCH_TEXT,
                },
            ]);
        }
    },

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

        const query =
            interaction.options.getString("song") || CONFIG.DEFAULT_SEARCH_TEXT;
        const nodeChoice =
            interaction.options.getString("lavalink_node") || undefined;

        if (nodeChoice) {
            if (client.manager.get(interaction.guild?.id || "")) {
                return await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "Hmmm, you have an active music player in this server. Please stop the current player before switching Lavalink nodes."
                        ),
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }

            const node = client.manager.nodes.find(
                (n: magmastream.Node) => n.options.identifier === nodeChoice
            );
            if (!node) {
                return await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "Invalid Lavalink node"
                        ),
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
            if (!node.connected) {
                return await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "Lavalink node is not connected"
                        ),
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        }

        if (query === CONFIG.DEFAULT_SEARCH_TEXT) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Please enter a song name or url"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        client.logger.info(
            `[PLAY] Play | User ${interaction.user.tag} | Query: ${query} | Guild: ${interaction.guildId}`
        );

        // Validate voice and music requirements
        const validator = new VoiceChannelValidator(client, interaction);
        for (const check of [
            validator.validateMusicSource(query),
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid)
                return await interaction.reply({
                    embeds: [embed],
                    flags: discord.MessageFlags.Ephemeral,
                });
        }

        const guildMember = interaction.guild?.members.cache.get(
            interaction.user.id
        );
        const player = client.manager.create({
            guildId: interaction.guildId || "",
            voiceChannelId: guildMember?.voice.channelId || "",
            textChannelId: interaction.channelId,
            node: nodeChoice,
            ...CONFIG.PLAYER_OPTIONS,
        });

        const [playerValid, playerEmbed] =
            await validator.validatePlayerConnection(player);
        if (!playerValid)
            return await interaction.reply({
                embeds: [playerEmbed],
                flags: discord.MessageFlags.Ephemeral,
            });

        await interaction.deferReply();

        if (!["CONNECTING", "CONNECTED"].includes(player.state)) {
            player.connect();
            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        `Connected to ${guildMember?.voice.channel?.name}`
                    ),
                ],
            });
        }

        try {
            const res = await client.manager.search(query, interaction.user);
            if (res.loadType === "error")
                throw new Error("No results found | loadType: error");

            const interactionContext = {
                type: "interaction" as const,
                interaction: interaction,
            }

            await handleSearchResult(res, player, interactionContext, client);
        } catch (error) {
            client.logger.error(`[PLAY] Play error: ${error}`);
            await interaction.followUp({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while processing the song",
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

export default playcommand;
