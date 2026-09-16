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
const radioCommand = {
    cooldown: 5,
    dj: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('radio')
        .setDescription('Play a live radio station')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addStringOption((option) => option.setName('station').setDescription('Station name, genre or frequency').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.station.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.station.description')).setRequired(true).setAutocomplete(true)),
    autocomplete: async (interaction, client) => {
        const autoComplete = new commands_1.AutoComplete(client, interaction);
        await autoComplete.radioAutocomplete();
    },
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.radio(interaction.options.getString('station', true));
    },
};
exports.default = radioCommand;
