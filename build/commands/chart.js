"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChartButtons = exports.createStatsSection = exports.createTopTracksSection = exports.createChartContainer = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const format_1 = __importDefault(require("../utils/format"));
const music_2 = require("../core/music");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const v2_1 = require("../utils/v2");
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const chartCommand = {
    cooldown: 60,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('chart')
        .setDescription('Display music analytics and charts')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.chart.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.chart.description'))
        .addStringOption((option) => option
        .setName('scope')
        .setDescription('Choose the scope for analytics')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.scope.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.scope.description'))
        .setRequired(true)
        .addChoices({ name: 'Personal', value: 'user', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.user') }, { name: 'Server', value: 'guild', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.guild') }, { name: 'Global', value: 'global', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.global') }))
        .addIntegerOption((option) => option.setName('limit').setDescription('Number of top items to display (5-10)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.limit.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.limit.description')).setRequired(false).setMinValue(5).setMaxValue(10)),
    execute: async (interaction, client) => {
        await interaction.deferReply();
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_2.MusicResponseHandler(client);
        const scope = interaction.options.getString('scope', true);
        const limit = interaction.options.getInteger('limit') || 5;
        try {
            let chartData = [];
            let analytics = null;
            let chartTitle = '';
            let chartColor = 0x5865f2;
            switch (scope) {
                case 'user': {
                    const [topSongs, userAnalytics] = await Promise.all([music_1.MusicDB.getUserTopSongs(interaction.user.id, limit), music_1.MusicDB.getUserMusicAnalytics(interaction.user.id)]);
                    if (!topSongs.length) {
                        const container = responseHandler.createInfoContainer(t('responses.chart.no_user_data'));
                        await interaction.editReply((0, v2_1.v2)(container));
                        return;
                    }
                    chartData = topSongs;
                    analytics = userAnalytics;
                    chartTitle = t('responses.chart.user_title', { user: interaction.user.displayName });
                    chartColor = 0x43b581;
                    break;
                }
                case 'guild': {
                    if (!interaction.guildId) {
                        const container = responseHandler.createErrorContainer(t('responses.errors.server_only'), locale);
                        await interaction.editReply((0, v2_1.v2)(container));
                        return;
                    }
                    const [topSongs, guildAnalytics] = await Promise.all([music_1.MusicDB.getGuildTopSongs(interaction.guildId, limit), music_1.MusicDB.getGuildMusicAnalytics(interaction.guildId)]);
                    if (!topSongs.length) {
                        const container = responseHandler.createInfoContainer(t('responses.chart.no_guild_data'));
                        await interaction.editReply((0, v2_1.v2)(container));
                        return;
                    }
                    chartData = topSongs;
                    analytics = guildAnalytics;
                    chartTitle = t('responses.chart.guild_title', { guild: interaction.guild?.name || 'Server' });
                    chartColor = 0xf1c40f;
                    break;
                }
                case 'global': {
                    const [topSongs, globalAnalytics] = await Promise.all([music_1.MusicDB.getGlobalTopSongs(limit), music_1.MusicDB.getGlobalMusicAnalytics()]);
                    if (!topSongs.length) {
                        const container = responseHandler.createInfoContainer(t('responses.chart.no_global_data'));
                        await interaction.editReply((0, v2_1.v2)(container));
                        return;
                    }
                    chartData = topSongs;
                    analytics = globalAnalytics;
                    chartTitle = t('responses.chart.global_title');
                    chartColor = 0xe74c3c;
                    break;
                }
            }
            if (!analytics) {
                client.logger.error(`[CHART_COMMAND] No analytics data found for scope: ${scope}`);
                const container = responseHandler.createErrorContainer(t('responses.errors.general_error'), locale, true);
                await interaction.editReply((0, v2_1.v2)(container));
                return;
            }
            const container = (0, exports.createChartContainer)(chartData, analytics, chartTitle, chartColor, t);
            await interaction.editReply((0, v2_1.v2)((0, v2_1.withRows)(container, (0, exports.createChartButtons)(client, t, scope, limit))));
        }
        catch (error) {
            client.logger.error(`[CHART_COMMAND] Error: ${error}`);
            const container = responseHandler.createErrorContainer(t('responses.errors.general_error'), locale, true);
            await interaction.editReply((0, v2_1.v2)(container));
        }
    },
};
const createChartContainer = (chartData, analytics, title, color, t) => {
    const container = (0, v2_1.panel)(color, {
        title: `📊 ${title}`,
        body: createAnalyticsOverview(analytics, t),
        thumbnail: chartData.length > 0 ? chartData[0]?.artworkUrl || chartData[0]?.thumbnail || null : null,
    });
    if (chartData.length > 0) {
        container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent((0, exports.createTopTracksSection)(chartData, t)));
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent((0, exports.createStatsSection)(analytics, t)));
    }
    container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent((0, v2_1.subtext)(`${t('responses.chart.footer')} • <t:${Math.floor(Date.now() / 1000)}:f>`)));
    return container;
};
exports.createChartContainer = createChartContainer;
const createAnalyticsOverview = (analytics, t) => {
    const totalTimeFormatted = format_1.default.formatListeningTime(analytics.totalPlaytime / 1000);
    const avgPlayCount = Math.round(analytics.averagePlayCount * 10) / 10;
    return [`🎵 **${analytics.totalSongs}** ${t('responses.chart.total_tracks')}`, `🎤 **${analytics.uniqueArtists}** ${t('responses.chart.unique_artists')}`, `⏱️ **${totalTimeFormatted}** ${t('responses.chart.total_listening_time')}`, `📈 **${avgPlayCount}** ${t('responses.chart.average_plays')}`, `🔥 **${analytics.recentActivity}** ${t('responses.chart.recent_activity')}`].join('\n');
};
const createTopTracksSection = (chartData, t) => {
    const tracksList = chartData
        .map((song, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const title = format_1.default.truncateText(song.title, 35);
        const artist = format_1.default.truncateText(song.author, 25);
        const plays = song.played_number;
        const duration = format_1.default.msToTime(song.duration);
        return `${medal} **${title}** - ${artist}\n└ ${plays} ${t('responses.chart.plays')} • ${duration}`;
    })
        .join('\n\n');
    return `**🎶 ${t('responses.chart.top_tracks')}**\n${tracksList.length > 1500 ? tracksList.substring(0, 1497) + '...' : tracksList}`;
};
exports.createTopTracksSection = createTopTracksSection;
const createStatsSection = (analytics, t) => {
    const totalHours = Math.round((analytics.totalPlaytime / (1000 * 60 * 60)) * 10) / 10;
    const avgSongLength = analytics.totalSongs > 0 ? format_1.default.msToTime(analytics.totalPlaytime / analytics.totalSongs) : '0:00:00';
    return `**⏰ ${t('responses.chart.listening_stats')}**\n${[`${t('responses.chart.total_hours')}: **${totalHours}h**`, `${t('responses.chart.avg_song_length')}: **${avgSongLength}**`, `${t('responses.chart.this_week')}: **${analytics.recentActivity}** ${t('responses.chart.tracks')}`].join('\n')}`;
};
exports.createStatsSection = createStatsSection;
/**
 * Scope and limit ride along in the custom id. A Components V2 message carries no
 * embeds, so the chart button handler can no longer read that state back off the
 * message it is attached to.
 */
const createChartButtons = (client, t, scope, limit, refreshDisabled = false) => {
    return new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder()
        .setCustomId(`chart_refresh:${scope}:${limit}`)
        .setLabel(t('responses.chart.buttons.refresh'))
        .setStyle(discord_js_1.default.ButtonStyle.Primary)
        .setEmoji('🔄')
        .setDisabled(refreshDisabled), new discord_js_1.default.ButtonBuilder().setCustomId(`chart_export:${scope}:${limit}`).setLabel(t('responses.chart.buttons.export')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('📊'), new discord_js_1.default.ButtonBuilder().setLabel(t('responses.buttons.support_server')).setStyle(discord_js_1.default.ButtonStyle.Link).setURL(client.config.bot.support_server.invite).setEmoji('🔧'));
};
exports.createChartButtons = createChartButtons;
exports.default = chartCommand;
