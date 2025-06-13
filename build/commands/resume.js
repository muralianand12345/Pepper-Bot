"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const resumeCommand = {
    cooldown: 1,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused music')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.resume.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.resume.description')),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.resume();
    },
};
exports.default = resumeCommand;
