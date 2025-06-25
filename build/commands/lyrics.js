"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const lyricsCommand = {
    cooldown: 5,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Display lyrics for the currently playing track')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addBooleanOption((option) => option.setName('skip_track_source').setDescription("Skip using the track's source URL when searching for lyrics").setNameLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.options.skip_track_source.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lyrics.options.skip_track_source.description')).setRequired(false)),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.lyrics();
    },
};
exports.default = lyricsCommand;
