"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const commands_1 = require("../core/commands");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const playCommand = {
    cooldown: 1,
    dj: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song via song name or url')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addStringOption((option) => option.setName('song').setDescription('Song Name/URL').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.description')).setRequired(true).setAutocomplete(true)),
    autocomplete: async (interaction, client) => {
        const autoComplete = new commands_1.AutoComplete(client, interaction);
        await autoComplete.playAutocomplete();
    },
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.play();
    },
};
exports.default = playCommand;
