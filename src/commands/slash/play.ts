import discord from "discord.js";
import { YouTubeAutoComplete } from "../../utils/auto_search";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { createErrorEmbed } from "../../utils/music/embed_template";
import { handleSearchResult } from "../../utils/music/music_functions";
import { SlashCommand } from "../../types";

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
        selfDeafen: true
    }
} as const;

/**
 * Slash command for playing music in voice channels
 * @type {SlashCommand}
 */
const playcommand: SlashCommand = {
    cooldown: 100,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song via song name or url')
        .addStringOption(option => option
            .setName('song')
            .setDescription('Song Name/URL')
            .setRequired(true)
            .setAutocomplete(true)
        ),

    /**
    * Handles song name autocomplete suggestions
    * @param {discord.AutocompleteInteraction} interaction - Autocomplete interaction
    * @param {discord.Client} client - Discord client instance
    * @returns {Promise<void>}
    */
    autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
        const focused = interaction.options.getFocused(true);

        if (focused.name !== 'song') return;

        try {
            const choices = !focused.value
                ? [{ name: CONFIG.DEFAULT_SEARCH_TEXT, value: CONFIG.DEFAULT_SEARCH_TEXT }]
                : (await new YouTubeAutoComplete().getSuggestions(focused.value))
                    .map(choice => ({ name: choice, value: choice }));

            await interaction.respond(choices);
        } catch (error) {
            client.logger.warn(`[SLASH_COMMAND] Autocomplete error: ${error}`);
            await interaction.respond([{
                name: CONFIG.DEFAULT_SEARCH_TEXT,
                value: CONFIG.DEFAULT_SEARCH_TEXT
            }]);
        }
    },

    /**
     * Executes the play command, handling music playback setup and validation
     * @param {discord.ChatInputCommandInteraction} interaction - Command interaction
     * @param {any} client - Discord client instance
     */
    execute: async (interaction, client) => {
        if (!client.config.music.enabled) {
            return await interaction.reply({
                embeds: [createErrorEmbed('Music is currently disabled')],
                ephemeral: true
            });
        }

        const query = interaction.options.getString('song') || CONFIG.DEFAULT_SEARCH_TEXT;
        if (query === CONFIG.DEFAULT_SEARCH_TEXT) {
            return await interaction.reply({
                embeds: [createErrorEmbed('Please enter a song name or url')],
                ephemeral: true
            });
        }

        client.logger.info(`[SLASH_COMMAND] Play | User ${interaction.user.tag} | Query: ${query} | Guild: ${interaction.guildId}`);

        // Validate voice and music requirements
        const validator = new VoiceChannelValidator(client, interaction);
        for (const check of [
            validator.validateMusicSource(query),
            validator.validateGuildContext(),
            validator.validateVoiceConnection()
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
        const player = client.manager.create({
            guild: interaction.guildId || "",
            voiceChannel: guildMember?.voice.channelId || "",
            textChannel: interaction.channelId,
            ...CONFIG.PLAYER_OPTIONS
        });

        const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
        if (!playerValid) return await interaction.reply({ embeds: [playerEmbed], ephemeral: true });

        await interaction.deferReply();

        if (!["CONNECTING", "CONNECTED"].includes(player.state)) {
            player.connect();
            await interaction.editReply({
                embeds: [new discord.EmbedBuilder()
                    .setColor('Green')
                    .setDescription(`Connected to ${guildMember?.voice.channel?.name}`)]
            });
        }

        try {
            const res = await client.manager.search(query, interaction.user);
            if (res.loadType === "error") throw new Error('Search error');
            await handleSearchResult(res, player, interaction, client);
        } catch (error) {
            client.logger.error(`[SLASH_COMMAND] Play error: ${error}`);
            await interaction.followUp({
                embeds: [createErrorEmbed('An error occurred while processing the song')],
                ephemeral: true
            });
        }
    }
};

export default playcommand;