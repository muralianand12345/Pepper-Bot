"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const autoplayCommand = {
    cooldown: 10,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle smart autoplay based on your music preferences')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addBooleanOption((option) => option.setName('enabled').setDescription('Enable or disable autoplay').setNameLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.options.enabled.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.autoplay.options.enabled.description')).setRequired(true)),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        const enabled = interaction.options.getBoolean('enabled', true);
        await music.autoplay(enabled);
    },
};
exports.default = autoplayCommand;
