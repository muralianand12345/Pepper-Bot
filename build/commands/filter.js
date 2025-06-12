"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const filterCommand = {
    cooldown: 3,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName("filter")
        .setDescription("Apply audio filters to enhance your music experience")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.filter.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.filter.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addStringOption(option => option.setName("type")
        .setDescription("Choose an audio filter to apply")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.filter.options.type.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.filter.options.type.description'))
        .setRequired(true)
        .addChoices(...Object.entries(music_1.MUSIC_CONFIG.AUDIO_FILTERS).map(([value, data]) => ({
        name: `${data.emoji} ${data.name} - ${data.description}`,
        value
    })))),
    execute: async (interaction, client) => {
        await interaction.deferReply();
        const music = new music_1.Music(client, interaction);
        const filterType = interaction.options.getString("type", true);
        await music.filter(filterType);
    }
};
exports.default = filterCommand;
