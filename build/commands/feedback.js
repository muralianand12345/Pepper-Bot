"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../utils/config");
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const configManager = config_1.ConfigManager.getInstance();
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const feedbackCommand = {
    cooldown: 30,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName("feedback")
        .setDescription("Send feedback to the developers")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.feedback.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.feedback.description')),
    modal: async (interaction) => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_1.MusicResponseHandler(interaction.client);
        try {
            const feedbackText = interaction.fields.getTextInputValue("feedback_input");
            const feedbackType = interaction.fields.getTextInputValue("feedback_type");
            const webhookUrl = configManager.getFeedbackWebhook();
            const webhook = new discord_js_1.default.WebhookClient({ url: webhookUrl });
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor("#5865f2")
                .setTitle("📝 New Feedback Received")
                .setDescription(`**Type:** ${feedbackType}\n**Feedback:**\n${feedbackText}`)
                .addFields([
                { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                { name: "Guild", value: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : "Direct Message", inline: true },
                { name: "Timestamp", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            ])
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: "Feedback System", iconURL: interaction.client.user?.displayAvatarURL() })
                .setTimestamp();
            await webhook.send({ content: `Feedback from ${interaction.user.tag} (${interaction.user.id})`, embeds: [embed], username: "Feedback Bot", avatarURL: interaction.client.user?.displayAvatarURL() });
            const successEmbed = responseHandler.createSuccessEmbed(t('responses.feedback.sent'), locale);
            await interaction.reply({ embeds: [successEmbed], flags: discord_js_1.default.MessageFlags.Ephemeral });
        }
        catch (error) {
            interaction.client.logger.error(`[FEEDBACK] Error sending feedback: ${error}`);
            const errorEmbed = responseHandler.createErrorEmbed(t('responses.errors.feedback_failed'), locale, true);
            if (!interaction.replied) {
                await interaction.reply({ embeds: [errorEmbed], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
            else {
                await interaction.followUp({ embeds: [errorEmbed], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        }
    },
    execute: async (interaction, client) => {
        const t = await localeDetector.getTranslator(interaction);
        const modal = new discord_js_1.default.ModalBuilder()
            .setCustomId("feedback_modal")
            .setTitle(t('modals.feedback.title'));
        const feedbackTypeInput = new discord_js_1.default.TextInputBuilder()
            .setCustomId("feedback_type")
            .setLabel(t('modals.feedback.type_label'))
            .setPlaceholder(t('modals.feedback.type_placeholder'))
            .setStyle(discord_js_1.default.TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(true);
        const feedbackInput = new discord_js_1.default.TextInputBuilder()
            .setCustomId("feedback_input")
            .setLabel(t('modals.feedback.feedback_label'))
            .setPlaceholder(t('modals.feedback.feedback_placeholder'))
            .setStyle(discord_js_1.default.TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true);
        const firstRow = new discord_js_1.default.ActionRowBuilder().addComponents(feedbackTypeInput);
        const secondRow = new discord_js_1.default.ActionRowBuilder().addComponents(feedbackInput);
        modal.addComponents(firstRow, secondRow);
        await interaction.showModal(modal);
    }
};
exports.default = feedbackCommand;
