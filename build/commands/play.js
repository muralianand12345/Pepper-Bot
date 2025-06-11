"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../utils/config");
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const configManager = config_1.ConfigManager.getInstance();
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const playCommand = {
    cooldown: 1,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song via song name or url")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addStringOption((option) => option
        .setName("song")
        .setDescription("Song Name/URL")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.description'))
        .setRequired(true)
        .setAutocomplete(true))
        .addStringOption((option) => option
        .setName("lavalink_node")
        .setDescription("Lavalink to play the song (Optional)")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.description'))
        .setRequired(false)
        .setAutocomplete(true)),
    autocomplete: async (interaction, client) => {
        const focused = interaction.options.getFocused(true);
        const t = await localeDetector.getTranslator(interaction);
        try {
            let suggestions;
            if (focused.name === "lavalink_node") {
                const nodes = client.manager.nodes.filter((node) => node.connected == true).map((node) => ({ name: `${node.options.identifier} (${node.options.host})`, value: node.options.identifier || "Unknown Node" }));
                suggestions = nodes.filter((option) => option.name.toLowerCase().includes(focused.value.toLowerCase()));
            }
            else if (focused.name === "song") {
                if (!focused.value) {
                    const defaultText = t('responses.default_search');
                    suggestions = [{ name: defaultText.slice(0, 100), value: defaultText }];
                }
                else {
                    focused.value = focused.value.split("?")[0].split("#")[0];
                    const isSpotifyLink = focused.value.match(/^(https:\/\/open\.spotify\.com\/|spotify:)/i);
                    const isStringWithoutHttp = focused.value.match(/^(?!https?:\/\/)([a-zA-Z0-9\s]+)$/);
                    if (isSpotifyLink || isStringWithoutHttp) {
                        suggestions = await new music_1.SpotifyAutoComplete(client, configManager.getSpotifyClientId(), configManager.getSpotifyClientSecret()).getSuggestions(focused.value);
                    }
                    else {
                        suggestions = [{ name: `${focused.value.slice(0, 80)}`, value: focused.value }];
                    }
                }
            }
            await interaction.respond(suggestions || []);
        }
        catch (error) {
            client.logger.error(`[PLAY_COMMAND] Autocomplete error: ${error}`);
            const errorText = t('responses.errors.no_results');
            await interaction.respond([{ name: errorText.slice(0, 100), value: errorText }]);
        }
    },
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.play();
    }
};
exports.default = playCommand;
