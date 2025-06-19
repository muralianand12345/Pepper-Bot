"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const pauseCommand = {
    cooldown: 1,
    data: new discord_js_1.default.SlashCommandBuilder().setName('pause').setDescription('Pause the currently playing music').setNameLocalizations(localizationManager.getCommandLocalizations('commands.pause.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.pause.description')),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.pause();
    },
};
exports.default = pauseCommand;
