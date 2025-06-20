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
const leaderboardCommand = {
    cooldown: 30,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View XP leaderboards')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.leaderboard.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.leaderboard.description'))
        .addStringOption((option) => option
        .setName('scope')
        .setDescription('Choose leaderboard scope')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.leaderboard.options.scope.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.leaderboard.options.scope.description'))
        .setRequired(true)
        .addChoices({ name: 'Global', value: 'global', name_localizations: localizationManager.getCommandLocalizations('commands.leaderboard.options.scope.choices.global') }, { name: 'Server', value: 'server', name_localizations: localizationManager.getCommandLocalizations('commands.leaderboard.options.scope.choices.server') }, { name: 'Daily', value: 'daily', name_localizations: localizationManager.getCommandLocalizations('commands.leaderboard.options.scope.choices.daily') }, { name: 'Weekly', value: 'weekly', name_localizations: localizationManager.getCommandLocalizations('commands.leaderboard.options.scope.choices.weekly') }))
        .addIntegerOption((option) => option.setName('limit').setDescription('Number of users to display (5-20)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.leaderboard.options.limit.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.leaderboard.options.limit.description')).setRequired(false).setMinValue(5).setMaxValue(20)),
    execute: async (interaction, client) => {
        await interaction.deferReply();
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_1.MusicResponseHandler(client);
        try {
            const scope = interaction.options.getString('scope', true);
            const limit = interaction.options.getInteger('limit') || 10;
            const leaderboardManager = gamification_1.LeaderboardManager.getInstance(client);
            const statsManager = gamification_1.StatsManager.getInstance(client);
            let embed;
            switch (scope) {
                case 'global': {
                    const globalLeaderboard = await leaderboardManager.getGlobalLeaderboard(limit);
                    embed = await leaderboardManager.createLeaderboardEmbed(globalLeaderboard, 'global', undefined, locale);
                    const userRank = await leaderboardManager.getUserRank(interaction.user.id);
                    if (userRank.globalRank > 0)
                        embed.addFields([{ name: t('responses.leaderboard.your_rank'), value: `#${userRank.globalRank}`, inline: true }]);
                    break;
                }
                case 'server': {
                    if (!interaction.guildId) {
                        const embed = responseHandler.createErrorEmbed(t('responses.errors.server_only'), locale);
                        await interaction.editReply({ embeds: [embed] });
                        return;
                    }
                    const guildLeaderboard = await leaderboardManager.getGuildLeaderboard(interaction.guildId, limit);
                    embed = await leaderboardManager.createLeaderboardEmbed(guildLeaderboard, 'guild', interaction.guild?.name, locale);
                    const userRank = await leaderboardManager.getUserRank(interaction.user.id, interaction.guildId);
                    if (userRank.guildRank && userRank.guildRank > 0)
                        embed.addFields([{ name: t('responses.leaderboard.your_rank'), value: `#${userRank.guildRank}`, inline: true }]);
                    break;
                }
                case 'daily': {
                    const dailyStats = await statsManager.getDailyStats(limit);
                    embed = new discord_js_1.default.EmbedBuilder().setColor('#ff6b6b').setTitle(t('responses.leaderboard.daily_title')).setTimestamp().setFooter({ text: 'Pepper Music XP System', iconURL: client.user?.displayAvatarURL() });
                    if (dailyStats.length === 0) {
                        embed.setDescription(t('responses.leaderboard.no_users'));
                    }
                    else {
                        const description = dailyStats
                            .map((entry) => {
                            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `**${entry.rank}.**`;
                            return `${medal} **${entry.username}**\n└ ${entry.dailyXP} XP today`;
                        })
                            .join('\n\n');
                        embed.setDescription(description);
                    }
                    break;
                }
                case 'weekly': {
                    const weeklyStats = await statsManager.getWeeklyStats(limit);
                    embed = new discord_js_1.default.EmbedBuilder().setColor('#4ecdc4').setTitle(t('responses.leaderboard.weekly_title')).setTimestamp().setFooter({ text: 'Pepper Music XP System', iconURL: client.user?.displayAvatarURL() });
                    if (weeklyStats.length === 0) {
                        embed.setDescription(t('responses.leaderboard.no_users'));
                    }
                    else {
                        const description = weeklyStats
                            .map((entry) => {
                            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `**${entry.rank}.**`;
                            return `${medal} **${entry.username}**\n└ ${entry.weeklyXP} XP this week`;
                        })
                            .join('\n\n');
                        embed.setDescription(description);
                    }
                    break;
                }
                default: {
                    const errorEmbed = responseHandler.createErrorEmbed('Invalid leaderboard scope', locale);
                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            client.logger.error(`[LEADERBOARD_COMMAND] Error: ${error}`);
            const embed = responseHandler.createErrorEmbed(t('responses.errors.leaderboard_error'), locale, true);
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
exports.default = leaderboardCommand;
