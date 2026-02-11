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
const twentyFourSevenCommand = {
    cooldown: 5,
    dj: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder().setName('24-7').setDescription('Toggle 24/7 mode to keep the bot in the voice channel').setNameLocalizations(localizationManager.getCommandLocalizations('commands.24-7.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.24-7.description')).setContexts(discord_js_1.default.InteractionContextType.Guild),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.twentyFourSeven();
    },
};
exports.default = twentyFourSevenCommand;
