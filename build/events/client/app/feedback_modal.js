"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../../../utils/config");
const v2_1 = require("../../../utils/v2");
const configManager = config_1.ConfigManager.getInstance();
const event = {
    name: discord_js_1.default.Events.InteractionCreate,
    execute: async (interaction, client) => {
        if (interaction.isButton() && interaction.customId.startsWith('feedback_request_')) {
            try {
                const guildId = interaction.customId.replace('feedback_request_', '');
                const modal = new discord_js_1.default.ModalBuilder().setCustomId(`feedback_modal_${guildId}`).setTitle(`${client.user?.username || 'Pepper'} Feedback`);
                const qualityInput = new discord_js_1.default.TextInputBuilder().setCustomId('feedback_quality').setLabel('How would you rate the audio quality? (1-5)').setPlaceholder('e.g., 4').setStyle(discord_js_1.default.TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(1);
                const usabilityInput = new discord_js_1.default.TextInputBuilder().setCustomId('feedback_usability').setLabel('How easy was it to use? (1-5)').setPlaceholder('e.g., 3').setStyle(discord_js_1.default.TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(1);
                const featuresInput = new discord_js_1.default.TextInputBuilder().setCustomId('feedback_features').setLabel('Did it have all features you needed?').setPlaceholder('If not, what was missing?').setStyle(discord_js_1.default.TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
                const issuesInput = new discord_js_1.default.TextInputBuilder().setCustomId('feedback_issues').setLabel('Did you experience any issues?').setPlaceholder('Disconnections, lag, delays?').setStyle(discord_js_1.default.TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
                const reasonInput = new discord_js_1.default.TextInputBuilder().setCustomId('feedback_reason').setLabel('Why did you remove the bot?').setPlaceholder('Main reason for removal').setStyle(discord_js_1.default.TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
                modal.addComponents(new discord_js_1.default.ActionRowBuilder().addComponents(qualityInput), new discord_js_1.default.ActionRowBuilder().addComponents(usabilityInput), new discord_js_1.default.ActionRowBuilder().addComponents(featuresInput), new discord_js_1.default.ActionRowBuilder().addComponents(issuesInput), new discord_js_1.default.ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal);
                client.logger.info(`[FEEDBACK] Showed server leave feedback modal to ${interaction.user.tag} (${interaction.user.id})`);
            }
            catch (error) {
                client.logger.error(`[FEEDBACK] Error showing feedback modal: ${error}`);
                try {
                    if (interaction.isRepliable())
                        await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.v2Text)('Sorry, there was an error displaying the feedback form. Please try again later or join our support server.')));
                }
                catch (replyError) {
                    client.logger.error(`[FEEDBACK] Failed to send error reply: ${replyError}`);
                }
            }
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('feedback_modal_')) {
            try {
                const webhookClient = new discord_js_1.default.WebhookClient({ url: configManager.getFeedbackWebhook() });
                const guildId = interaction.customId.replace('feedback_modal_', '');
                const audioQuality = interaction.fields.getTextInputValue('feedback_quality');
                const usability = interaction.fields.getTextInputValue('feedback_usability');
                const features = interaction.fields.getTextInputValue('feedback_features');
                const issues = interaction.fields.getTextInputValue('feedback_issues');
                const reason = interaction.fields.getTextInputValue('feedback_reason');
                const details = (0, v2_1.fields)([
                    ['🎵 Audio Quality Rating', `**${audioQuality}/5**`],
                    ['🔧 Usability Rating', `**${usability}/5**`],
                    ['🧩 Features Feedback', features || 'No feedback provided'],
                    ['⚠️ Issues Experienced', issues || 'No issues reported'],
                    ['❌ Removal Reason', reason],
                    ['💡 User Information', `\`${interaction.user.id}\` • created <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`],
                ]);
                const container = (0, v2_1.panel)(0xed4245, {
                    title: '📝 Server Leave Feedback',
                    body: `Feedback from **${interaction.user.tag}** after removing the bot from a server.\n\nServer ID: \`${guildId}\`\n\n${details}`,
                    thumbnail: interaction.user.displayAvatarURL({ size: 128 }),
                    footer: `Server Leave Feedback | ${new Date().toLocaleDateString()}`,
                    timestamp: true,
                });
                await webhookClient.send((0, v2_1.v2Webhook)(container));
                await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.v2Text)(`Thank you for your valuable feedback! We'll use it to improve ${client.user?.username} Music Bot for everyone.`)));
                client.logger.info(`[FEEDBACK] Received server leave feedback from ${interaction.user.tag} (${interaction.user.id}) for guild ${guildId}`);
            }
            catch (error) {
                client.logger.error(`[FEEDBACK] Error processing feedback modal submission: ${error}`);
                try {
                    if (interaction.isRepliable())
                        await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.v2Text)('Sorry, there was an error processing your feedback. Please try again later or join our support server.')));
                }
                catch (replyError) {
                    client.logger.error(`[FEEDBACK] Failed to send error reply: ${replyError}`);
                }
            }
        }
    },
};
exports.default = event;
