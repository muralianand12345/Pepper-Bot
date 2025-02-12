import discord from "discord.js";
import { SpotifyAutoComplete } from "../../utils/auto_search";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { handleSearchResult } from "../../utils/music/music_functions";
import { ConfigManager } from "../../utils/config";
import { SlashCommand } from "../../types";

// Load environment variables
const configManager = ConfigManager.getInstance();

/**
 * Configuration for music playback settings
 * @type {const}
 */
const CONFIG = {
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

        if (focused.name !== "song") return;

        try {
            const suggestions = !focused.value
                ? [
                      {
                          name: CONFIG.DEFAULT_SEARCH_TEXT,
                          value: CONFIG.DEFAULT_SEARCH_TEXT,
                      },
                  ]
                : await new SpotifyAutoComplete(
                      configManager.getSpotifyClientId(),
                      configManager.getSpotifyClientSecret()
                  ).getSuggestions(focused.value);

            await interaction.respond(suggestions);
        } catch (error) {
            client.logger.warn(`[SLASH_COMMAND] Autocomplete error: ${error}`);
            await interaction.respond([
                {
                    name: CONFIG.DEFAULT_SEARCH_TEXT,
                    value: CONFIG.DEFAULT_SEARCH_TEXT,
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
            `[SLASH_COMMAND] Play | User ${interaction.user.tag} | Query: ${query} | Guild: ${interaction.guildId}`
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
            if (res.loadType === "error") throw new Error("Search error");
            await handleSearchResult(res, player, interaction, client);
        } catch (error) {
            client.logger.error(`[SLASH_COMMAND] Play error: ${error}`);
            await interaction.followUp({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while processing the song"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }
    },
};

export default playcommand;
