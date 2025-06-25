"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../utils/config");
const music_1 = require("../core/music");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const configManager = config_1.ConfigManager.getInstance();
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const playCommand = {
    cooldown: 1,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song via song name or url')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addStringOption((option) => option.setName('song').setDescription('Song Name/URL').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.description')).setRequired(true).setAutocomplete(true))
        .addStringOption((option) => option.setName('lavalink_node').setDescription('Lavalink to play the song (Optional)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.description')).setRequired(false).setAutocomplete(true)),
    autocomplete: async (interaction, client) => {
        let hasResponded = false;
        const safeRespond = async (suggestions) => {
            if (hasResponded || !interaction.isAutocomplete())
                return;
            try {
                await interaction.respond(suggestions);
                hasResponded = true;
            }
            catch (error) {
                if (!hasResponded) {
                    client.logger.warn(`[PLAY_COMMAND] Failed to respond to autocomplete: ${error}`);
                }
            }
        };
        const focused = interaction.options.getFocused(true);
        try {
            if (focused.name === 'lavalink_node') {
                const nodes = client.manager.nodes
                    .filter((node) => node.connected)
                    .map((node) => ({
                    name: `${node.options.identifier} (${node.options.host})`,
                    value: node.options.identifier || 'Unknown Node',
                }));
                const filteredNodes = nodes.filter((option) => option.name.toLowerCase().includes(focused.value.toLowerCase()));
                await safeRespond(filteredNodes);
                return;
            }
            if (focused.name === 'song') {
                if (!focused.value?.trim()) {
                    const t = await localeDetector.getTranslator(interaction);
                    const defaultText = t('responses.default_search');
                    await safeRespond([{ name: defaultText.slice(0, 100), value: defaultText }]);
                    return;
                }
                const cleanValue = focused.value.split('?')[0].split('#')[0].trim();
                const isSpotifyLink = /^(https:\/\/open\.spotify\.com\/|spotify:)/i.test(cleanValue);
                const isStringWithoutHttp = /^(?!https?:\/\/)([a-zA-Z0-9\s]+)$/.test(cleanValue);
                if (isSpotifyLink || isStringWithoutHttp) {
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Spotify API timeout')), 2000));
                    const user_language = await localeDetector.getUserLanguage(interaction.user.id);
                    const spotifyPromise = new music_1.SpotifyAutoComplete(client, configManager.getSpotifyClientId(), configManager.getSpotifyClientSecret(), user_language || 'en').getSuggestions(cleanValue);
                    try {
                        const suggestions = await Promise.race([spotifyPromise, timeoutPromise]);
                        await safeRespond(suggestions);
                    }
                    catch (spotifyError) {
                        client.logger.warn(`[PLAY_COMMAND] Spotify autocomplete error: ${spotifyError}`);
                        await safeRespond([{ name: cleanValue.slice(0, 80), value: cleanValue }]);
                    }
                }
                else {
                    await safeRespond([{ name: cleanValue.slice(0, 80), value: cleanValue }]);
                }
            }
        }
        catch (error) {
            client.logger.error(`[PLAY_COMMAND] Autocomplete error: ${error}`);
            if (!hasResponded) {
                try {
                    await safeRespond([]);
                }
                catch (respondError) {
                    client.logger.error(`[PLAY_COMMAND] Failed final respond: ${respondError}`);
                }
            }
        }
    },
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.play();
    },
};
exports.default = playCommand;
