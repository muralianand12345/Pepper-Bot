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
const localeDetector = new locales_1.LocaleDetector();
const localizationManager = locales_1.LocalizationManager.getInstance();
const buildResultEmbed = (result, t) => {
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
    return new discord_js_1.default.EmbedBuilder().setColor(config.color).setTitle(t(config.titleKey)).setDescription(t(config.descriptionKey)).setTimestamp();
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
            if (existingAccount) {
                const embed = new discord_js_1.default.EmbedBuilder().setColor('#FF4444').setTitle(t('responses.login.already_logged_in.title')).setDescription(t('responses.login.already_logged_in.description')).setTimestamp();
                return await interaction.editReply({ embeds: [embed] });
            }
            const authUrl = music_1.SpotifyManager.generateAuthUrl(interaction.user.id);
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor('#1DB954')
                .setTitle(t('responses.login.connect_title'))
                .setDescription(t('responses.login.connect_description'))
                .setFooter({ text: t('responses.login.auth_footer') })
                .setTimestamp();
            const row = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setLabel('Connect Spotify').setStyle(discord_js_1.default.ButtonStyle.Link).setURL(authUrl).setEmoji('🎵'));
            await interaction.editReply({ embeds: [embed], components: [row] });
            (0, authEmitter_1.waitForAuth)(interaction.user.id, 5 * 60 * 1000).then(async (result) => {
                try {
                    const resultEmbed = buildResultEmbed(result, t);
                    await interaction.editReply({ embeds: [resultEmbed], components: [] });
                }
                catch (err) {
                    console.error('[LOGIN] Failed to update embed after auth:', err);
                }
            });
            return;
        }
    },
};
exports.default = loginCommand;
