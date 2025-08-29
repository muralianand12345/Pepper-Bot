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
const stopCommand = {
    cooldown: 1,
    dj: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder().setName('stop').setDescription('Stop the music and disconnect from voice channel').setNameLocalizations(localizationManager.getCommandLocalizations('commands.stop.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.stop.description')),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.stop();
    },
};
exports.default = stopCommand;
