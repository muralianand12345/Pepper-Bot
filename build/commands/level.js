"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const gamification_1 = require("../core/music/gamification");
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const levelCommand = {
    cooldown: 10,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('level')
        .setDescription('View your XP level and stats')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.level.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.level.description'))
        .addUserOption((option) => option.setName('user').setDescription("View another user's level (optional)").setNameLocalizations(localizationManager.getCommandLocalizations('commands.level.options.user.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.level.options.user.description')).setRequired(false)),
    execute: async (interaction, client) => {
        await interaction.deferReply();
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_1.MusicResponseHandler(client);
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const statsManager = gamification_1.StatsManager.getInstance(client);
            const userStats = await statsManager.getUserStats(targetUser.id, interaction.guildId || undefined);
            if (!userStats) {
                const embed = responseHandler.createInfoEmbed(t('responses.level.no_stats'), locale);
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            const statsEmbed = await statsManager.createStatsEmbed(targetUser, userStats, interaction.guildId || undefined, locale);
            await interaction.editReply({ embeds: [statsEmbed] });
        }
        catch (error) {
            client.logger.error(`[LEVEL_COMMAND] Error: ${error}`);
            const embed = responseHandler.createErrorEmbed(t('responses.errors.stats_error'), locale, true);
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
exports.default = levelCommand;
