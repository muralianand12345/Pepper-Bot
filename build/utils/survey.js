"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveyHandler = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const locales_1 = require("../core/locales");
class SurveyHandler {
    constructor() {
        this.lastSentUsers = new Set();
        this.COOLDOWN_TIME = 24 * 60 * 60 * 1000; // 24 hours
        this.startCleanupTimer = () => {
            setInterval(() => this.lastSentUsers.clear(), this.COOLDOWN_TIME);
        };
        this.shouldSendSurvey = (client, userId) => {
            if (!client.config.survey?.enabled)
                return false;
            if (this.lastSentUsers.has(userId))
                return false;
            const probability = client.config.survey.probability || 0.05;
            return Math.random() < probability;
        };
        this.sendSurvey = async (client, interaction) => {
            try {
                if (!this.shouldSendSurvey(client, interaction.user.id))
                    return;
                const t = await this.localeDetector.getTranslator(interaction);
                const surveyEmbed = new discord_js_1.default.EmbedBuilder().setColor('#5865f2').setTitle(t('survey.title')).setDescription(t('survey.description')).setFooter({ text: t('survey.footer'), iconURL: client.user?.displayAvatarURL() }).setTimestamp();
                const surveyButton = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setLabel(t('survey.button')).setStyle(discord_js_1.default.ButtonStyle.Link).setURL(client.config.survey?.url || '').setEmoji('📋'), new discord_js_1.default.ButtonBuilder().setLabel(t('responses.buttons.support_server')).setStyle(discord_js_1.default.ButtonStyle.Link).setURL('https://discord.gg/XzE9hSbsNb').setEmoji('🔧'));
                await interaction.followUp({ embeds: [surveyEmbed], components: [surveyButton], flags: discord_js_1.default.MessageFlags.Ephemeral });
                this.lastSentUsers.add(interaction.user.id);
                client.logger.info(`[SURVEY] Sent survey to user ${interaction.user.tag} (${interaction.user.id})`);
            }
            catch (error) {
                client.logger.error(`[SURVEY] Error sending survey: ${error}`);
            }
        };
        this.addUserToCooldown = (userId) => {
            this.lastSentUsers.add(userId);
        };
        this.removeUserFromCooldown = (userId) => {
            this.lastSentUsers.delete(userId);
        };
        this.isUserOnCooldown = (userId) => {
            return this.lastSentUsers.has(userId);
        };
        this.localeDetector = new locales_1.LocaleDetector();
        this.startCleanupTimer();
    }
}
exports.SurveyHandler = SurveyHandler;
SurveyHandler.getInstance = () => {
    if (!SurveyHandler.instance)
        SurveyHandler.instance = new SurveyHandler();
    return SurveyHandler.instance;
};
