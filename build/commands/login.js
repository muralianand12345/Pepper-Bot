"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const authEmitter_1 = require("../utils/authEmitter");
const v2_1 = require("../utils/v2");
const localeDetector = new locales_1.LocaleDetector();
const localizationManager = locales_1.LocalizationManager.getInstance();
const buildResultContainer = (result, t) => {
    const configs = {
        success: {
            color: 0x1db954,
            titleKey: 'responses.login.success.title',
            descriptionKey: 'responses.login.success.description',
        },
        failed: {
            color: 0xff4444,
            titleKey: 'responses.login.failed.title',
            descriptionKey: 'responses.login.failed.description',
        },
        timeout: {
            color: 0xffa500,
            titleKey: 'responses.login.timeout.title',
            descriptionKey: 'responses.login.timeout.description',
        },
    };
    const config = configs[result];
    return (0, v2_1.panel)(config.color, { title: t(config.titleKey), body: t(config.descriptionKey), timestamp: true });
};
const loginCommand = {
    cooldown: 15,
    premium: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('login')
        .setDescription('Connect your music account to Pepper')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.login.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.login.description'))
        .addStringOption((option) => option.setName('account').setDescription('The music service to connect').setNameLocalizations(localizationManager.getCommandLocalizations('commands.login.options.account.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.login.options.account.description')).setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),
    execute: async (interaction) => {
        await interaction.deferReply({ flags: discord_js_1.default.MessageFlags.Ephemeral });
        const t = await localeDetector.getTranslator(interaction);
        const account = interaction.options.getString('account', true);
        if (account === 'spotify') {
            const existingAccount = await new music_1.SpotifyManager(interaction.client).getAccount(interaction.user.id);
            if (existingAccount)
                return await interaction.editReply((0, v2_1.v2)((0, v2_1.panel)(0xff4444, { title: t('responses.login.already_logged_in.title'), body: t('responses.login.already_logged_in.description'), timestamp: true })));
            const authUrl = music_1.SpotifyManager.generateAuthUrl(interaction.user.id);
            const container = (0, v2_1.panel)(0x1db954, { title: t('responses.login.connect_title'), body: t('responses.login.connect_description'), footer: t('responses.login.auth_footer'), timestamp: true });
            const row = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setLabel('Connect Spotify').setStyle(discord_js_1.default.ButtonStyle.Link).setURL(authUrl).setEmoji('🎵'));
            await interaction.editReply((0, v2_1.v2)((0, v2_1.withRows)(container, row)));
            (0, authEmitter_1.waitForAuth)(interaction.user.id, 5 * 60 * 1000).then(async (result) => {
                try {
                    await interaction.editReply((0, v2_1.v2)(buildResultContainer(result, t)));
                }
                catch (err) {
                    console.error('[LOGIN] Failed to update message after auth:', err);
                }
            });
            return;
        }
    },
};
exports.default = loginCommand;
