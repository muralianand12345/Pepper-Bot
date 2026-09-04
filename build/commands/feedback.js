"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../utils/config");
const types_1 = require("../types");
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const v2_1 = require("../utils/v2");
const configManager = config_1.ConfigManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const localizationManager = locales_1.LocalizationManager.getInstance();
const feedbackCommand = {
    cooldown: 60,
    category: types_1.CommandCategory.UTILITY,
    data: new discord_js_1.default.SlashCommandBuilder().setName('feedback').setDescription('Send feedback to the developers').setNameLocalizations(localizationManager.getCommandLocalizations('commands.feedback.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.feedback.description')),
    modal: async (interaction) => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_1.MusicResponseHandler(interaction.client);
        try {
            const feedbackText = interaction.fields.getTextInputValue('feedback_input');
            const feedbackType = interaction.fields.getTextInputValue('feedback_type');
            const webhookUrl = configManager.getFeedbackWebhook();
            const webhook = new discord_js_1.default.WebhookClient({ url: webhookUrl });
            const details = (0, v2_1.fields)([
                ['Type', feedbackType],
                ['User', `${interaction.user.tag} (${interaction.user.id})`],
                ['Guild', interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'Direct Message'],
                ['Timestamp', `<t:${Math.floor(Date.now() / 1000)}:F>`],
            ]);
            const container = (0, v2_1.panel)(0x5865f2, {
                title: '📝 New Feedback Received',
                body: `${details}\n\n**Feedback:**\n${feedbackText}`,
                thumbnail: interaction.user.displayAvatarURL(),
                footer: 'Feedback System',
                timestamp: true,
            });
            await webhook.send({ ...(0, v2_1.v2Webhook)((0, v2_1.v2Text)(`Feedback from ${interaction.user.tag} (${interaction.user.id})`), container), username: 'Feedback Bot', avatarURL: interaction.client.user?.displayAvatarURL() });
            const successContainer = responseHandler.createSuccessContainer(t('responses.feedback.sent'));
            await interaction.reply((0, v2_1.v2Ephemeral)(successContainer));
        }
        catch (error) {
            interaction.client.logger.error(`[FEEDBACK] Error sending feedback: ${error}`);
            const errorContainer = responseHandler.createErrorContainer(t('responses.errors.feedback_failed'), locale, true);
            if (!interaction.replied) {
                await interaction.reply((0, v2_1.v2Ephemeral)(errorContainer));
            }
            else {
                await interaction.followUp((0, v2_1.v2Ephemeral)(errorContainer));
            }
        }
    },
    execute: async (interaction, _client) => {
        const t = await localeDetector.getTranslator(interaction);
        const modal = new discord_js_1.default.ModalBuilder().setCustomId('feedback_modal').setTitle(t('modals.feedback.title'));
        const feedbackTypeInput = new discord_js_1.default.TextInputBuilder().setCustomId('feedback_type').setLabel(t('modals.feedback.type_label')).setPlaceholder(t('modals.feedback.type_placeholder')).setStyle(discord_js_1.default.TextInputStyle.Short).setMaxLength(50).setRequired(true);
        const feedbackInput = new discord_js_1.default.TextInputBuilder().setCustomId('feedback_input').setLabel(t('modals.feedback.feedback_label')).setPlaceholder(t('modals.feedback.feedback_placeholder')).setStyle(discord_js_1.default.TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true);
        const firstRow = new discord_js_1.default.ActionRowBuilder().addComponents(feedbackTypeInput);
        const secondRow = new discord_js_1.default.ActionRowBuilder().addComponents(feedbackInput);
        modal.addComponents(firstRow, secondRow);
        await interaction.showModal(modal);
    },
};
exports.default = feedbackCommand;
