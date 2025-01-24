import discord from "discord.js";
import magmastream from "magmastream";
import { YouTubeAutoComplete } from "../../utils/auto_search";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { musicButton, createErrorEmbed } from "../../utils/music/embed_template";
import Formatter from "../../utils/format";
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

/**
 * Processes search results and manages music playback
 * @param {magmastream.SearchResult} res - Music search results
 * @param {magmastream.Player} player - Music player instance
 * @param {discord.ChatInputCommandInteraction} interaction - Command interaction
 * @param {any} client - Discord client instance
 */
const handleSearchResult = async (
    res: magmastream.SearchResult,
    player: magmastream.Player,
    interaction: discord.ChatInputCommandInteraction,
    client: any
): Promise<void> => {
    const searchQuery = interaction.options.getString('song', true);

    switch (res.loadType) {
        case "empty": {
            if (!player.queue.current) player.destroy();
            await interaction.followUp({
                embeds: [new discord.EmbedBuilder()
                    .setColor('Red')
                    .setTitle('🤔 Hmm...')
                    .setDescription('No results found')],
                ephemeral: true
            });
            break;
        }

        case "track":
        case "search": {
            const track = res.tracks[0];
            player.queue.add(track);
            if (!player.playing && !player.paused && !player.queue.size) player.play();

            await interaction.followUp({
                embeds: [createTrackEmbed(track, client)],
                components: [musicButton],
                ephemeral: false
            });
            break;
        }

        case "playlist": {
            if (!res.playlist) break;
            res.playlist.tracks.forEach(track => player.queue.add(track));
            if (!player.playing && !player.paused && !player.queue.totalSize) player.play();

            await interaction.followUp({
                embeds: [createPlaylistEmbed(res.playlist, searchQuery, interaction.user.tag, client)]
            });
            break;
        }
    }
}

/**
 * Creates a rich embed for displaying track information
 * @param {magmastream.Track} track - Music track information
 * @param {any} client - Discord client instance
 * @returns {discord.EmbedBuilder} Formatted embed for track
 */
const createTrackEmbed = (track: magmastream.Track, client: any): discord.EmbedBuilder => {
    return new discord.EmbedBuilder()
        .setTitle('📀 Added to queue!')
        .setDescription(Formatter.hyperlink(Formatter.truncateText(track.title), track.uri))
        .setThumbnail(track.artworkUrl)
        .setColor(client.config.content.embed.music_playing.color)
        .addFields(
            { name: 'Duration', value: `┕** \`${track.isStream ? 'Live Stream' : Formatter.msToTime(track.duration)}\`**`, inline: true },
            { name: 'Requested by', value: `┕** ${track.requester}**`, inline: true },
            { name: 'Author', value: `┕** ${track.author}**`, inline: true }
        );
}

/**
 * Creates a rich embed for displaying playlist information
 * @param {magmastream.PlaylistData} playlist - Playlist information
 * @param {string} query - Original search query
 * @param {string} requester - User who requested the playlist
 * @param {any} client - Discord client instance
 * @returns {discord.EmbedBuilder} Formatted embed for playlist
 */
const createPlaylistEmbed = (
    playlist: magmastream.PlaylistData,
    query: string,
    requester: string,
    client: any
): discord.EmbedBuilder => {
    return new discord.EmbedBuilder()
        .setTitle('📋 Added playlist to queue!')
        .setDescription(Formatter.hyperlink(Formatter.truncateText(playlist.name || "", 50), query))
        .setThumbnail(playlist.tracks[0].artworkUrl || "")
        .setColor(client.config.content.embed.music_playing.color)
        .addFields(
            { name: 'Playlist Duration', value: `┕** \`${Formatter.msToTime(playlist.duration || 0)}\`**`, inline: true },
            { name: 'Total Tracks', value: `┕** ${playlist.tracks.length}**`, inline: true },
            { name: 'Requested by', value: `┕** ${requester}**`, inline: true }
        );
}

export default playcommand;