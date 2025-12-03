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
const volumeCommand = {
    cooldown: 120,
    dj: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the volume for the music player')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.volume.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.volume.description'))
        .addIntegerOption((option) => option.setName('volume').setDescription('Volume level (0-100)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.volume.options.volume.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.volume.options.volume.description')).setRequired(true)),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        const volume = interaction.options.getInteger('volume', true);
        await music.volume(volume);
    },
};
exports.default = volumeCommand;
