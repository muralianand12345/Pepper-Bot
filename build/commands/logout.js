"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutCommand = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const v2_1 = require("../utils/v2");
const localeDetector = new locales_1.LocaleDetector();
const localizationManager = locales_1.LocalizationManager.getInstance();
exports.logoutCommand = {
    cooldown: 15,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('logout')
        .setDescription('Disconnect your music account from Pepper')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.logout.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.logout.description'))
        .addStringOption((option) => option.setName('account').setDescription('The music service to disconnect').setNameLocalizations(localizationManager.getCommandLocalizations('commands.logout.options.account.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.logout.options.account.description')).setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),
    execute: async (interaction) => {
        await interaction.deferReply({ flags: discord_js_1.default.MessageFlags.Ephemeral });
        const t = await localeDetector.getTranslator(interaction);
        const account = interaction.options.getString('account', true);
        if (account === 'spotify') {
            const existingAccount = await new music_1.SpotifyManager(interaction.client).getAccount(interaction.user.id);
            if (!existingAccount)
                return await interaction.editReply((0, v2_1.v2)((0, v2_1.panel)(0xff4444, { title: t('responses.logout.not_logged_in.title'), body: t('responses.logout.not_logged_in.description'), timestamp: true })));
            const removed = await new music_1.SpotifyManager(interaction.client).removeAccount(interaction.user.id);
            if (!removed)
                return await interaction.editReply((0, v2_1.v2)((0, v2_1.panel)(0xff4444, { title: t('responses.logout.disconnect_error.title'), body: t('responses.logout.disconnect_error.description'), timestamp: true })));
            return await interaction.editReply((0, v2_1.v2)((0, v2_1.panel)(0x1db954, { title: t('responses.logout.disconnected.title'), body: t('responses.logout.disconnected.description'), timestamp: true })));
        }
    },
};
exports.default = exports.logoutCommand;
