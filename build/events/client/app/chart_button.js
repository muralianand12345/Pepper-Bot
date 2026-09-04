"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../../../core/music");
const format_1 = __importDefault(require("../../../utils/format"));
const locales_1 = require("../../../core/locales");
const music_2 = require("../../../core/music");
const chart_1 = require("../../../commands/chart");
const v2_1 = require("../../../utils/v2");
const CHART_BUTTON_IDS = ['chart_refresh', 'chart_export'];
const CHART_SCOPES = ['user', 'guild', 'global'];
const localeDetector = new locales_1.LocaleDetector();
const validateChartButtonInteraction = (interaction) => {
    return interaction.isButton() && CHART_BUTTON_IDS.includes(interaction.customId.split(':')[0]);
};
const parseChartCustomId = (customId) => {
    const [, scope, rawLimit] = customId.split(':');
    if (!scope || !CHART_SCOPES.includes(scope))
        return null;
    const limit = Number.parseInt(rawLimit, 10);
    return { scope, limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 10 };
};
const generateChartData = async (scope, userId, guildId, limit) => {
    switch (scope) {
        case 'user': {
            const [topSongs, analytics] = await Promise.all([music_1.MusicDB.getUserTopSongs(userId, limit), music_1.MusicDB.getUserMusicAnalytics(userId)]);
            return { chartData: topSongs, analytics };
        }
        case 'guild': {
            if (!guildId)
                return { chartData: [], analytics: null };
            const [topSongs, analytics] = await Promise.all([music_1.MusicDB.getGuildTopSongs(guildId, limit), music_1.MusicDB.getGuildMusicAnalytics(guildId)]);
            return { chartData: topSongs, analytics };
        }
        case 'global': {
            const [topSongs, analytics] = await Promise.all([music_1.MusicDB.getGlobalTopSongs(limit), music_1.MusicDB.getGlobalMusicAnalytics()]);
            return { chartData: topSongs, analytics };
        }
        default:
            return { chartData: [], analytics: null };
    }
};
const createExportData = (chartData) => {
    let csvContent = 'Rank,Song Title,Artist,Play Count,Duration,Source,Last Played\n';
    chartData.forEach((song, index) => {
        const rank = index + 1;
        const title = song.title?.replace(/,/g, ';') || 'Unknown';
        const artist = song.author?.replace(/,/g, ';') || 'Unknown';
        const playCount = song.played_number || 0;
        const duration = format_1.default.msToTime(song.duration || 0);
        const source = song.sourceName || 'Unknown';
        const lastPlayed = new Date(song.timestamp).toLocaleDateString();
        csvContent += `${rank},"${title}","${artist}",${playCount},"${duration}","${source}","${lastPlayed}"\n`;
    });
    return csvContent;
};
const refreshChart = async (interaction, client) => {
    const locale = await localeDetector.detectLocale(interaction);
    const t = await localeDetector.getTranslator(interaction);
    const responseHandler = new music_2.MusicResponseHandler(client);
    const chartInfo = parseChartCustomId(interaction.customId);
    if (!chartInfo)
        return await interaction.reply((0, v2_1.v2Ephemeral)(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale)));
    await interaction.deferUpdate();
    try {
        const { chartData, analytics } = await generateChartData(chartInfo.scope, interaction.user.id, interaction.guildId, chartInfo.limit);
        if (!chartData.length || !analytics) {
            await interaction.editReply((0, v2_1.v2)(responseHandler.createInfoContainer(t('responses.chart.no_data'))));
            return;
        }
        let chartTitle;
        let chartColor;
        switch (chartInfo.scope) {
            case 'user':
                chartTitle = t('responses.chart.user_title', { user: interaction.user.displayName });
                chartColor = 0x43b581;
                break;
            case 'guild':
                chartTitle = t('responses.chart.guild_title', { guild: interaction.guild?.name || 'Server' });
                chartColor = 0xf1c40f;
                break;
            case 'global':
                chartTitle = t('responses.chart.global_title');
                chartColor = 0xe74c3c;
                break;
            default:
                chartTitle = 'Music Chart';
                chartColor = 0x5865f2;
        }
        const container = (0, chart_1.createChartContainer)(chartData.slice(0, 10), analytics, `${chartTitle} 🔄`, chartColor, t);
        await interaction.editReply((0, v2_1.v2)((0, v2_1.withRows)(container, (0, chart_1.createChartButtons)(client, t, chartInfo.scope, chartInfo.limit, true))));
    }
    catch (error) {
        client.logger.error(`[CHART_REFRESH] Error: ${error}`);
        await interaction.editReply((0, v2_1.v2)(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale, true)));
    }
};
const exportChartData = async (interaction, client) => {
    const locale = await localeDetector.detectLocale(interaction);
    const t = await localeDetector.getTranslator(interaction);
    const responseHandler = new music_2.MusicResponseHandler(client);
    const chartInfo = parseChartCustomId(interaction.customId);
    if (!chartInfo)
        return await interaction.reply((0, v2_1.v2Ephemeral)(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale)));
    await interaction.deferReply({ flags: discord_js_1.default.MessageFlags.Ephemeral });
    try {
        const { chartData } = await generateChartData(chartInfo.scope, interaction.user.id, interaction.guildId, 50);
        if (!chartData.length) {
            const container = responseHandler.createInfoContainer(t('responses.chart.no_data'));
            await interaction.editReply((0, v2_1.v2)(container));
            return;
        }
        const csvData = createExportData(chartData);
        const buffer = Buffer.from(csvData, 'utf-8');
        const filename = `music-chart-${chartInfo.scope}-${Date.now()}.csv`;
        const attachment = new discord_js_1.default.AttachmentBuilder(buffer, { name: filename });
        const container = responseHandler.createSuccessContainer(`📊 ${t('responses.chart.export_success', { scope: chartInfo.scope, count: chartData.length })}`);
        await interaction.editReply({ ...(0, v2_1.v2)(container), files: [attachment] });
    }
    catch (error) {
        client.logger.error(`[CHART_EXPORT] Error: ${error}`);
        const container = responseHandler.createErrorContainer(t('responses.errors.general_error'), locale, true);
        await interaction.editReply((0, v2_1.v2)(container));
    }
};
const handleChartButtonAction = async (interaction, client) => {
    try {
        switch (interaction.customId.split(':')[0]) {
            case 'chart_refresh':
                await refreshChart(interaction, client);
                break;
            case 'chart_export':
                await exportChartData(interaction, client);
                break;
            default:
                client.logger.warn(`[CHART_BUTTON] Unknown button interaction: ${interaction.customId}`);
                break;
        }
    }
    catch (error) {
        client.logger.error(`[CHART_BUTTON] Error handling button ${interaction.customId}: ${error}`);
        if (!interaction.replied && !interaction.deferred) {
            try {
                const t = await localeDetector.getTranslator(interaction);
                await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.v2Text)(`❌ ${t('responses.errors.general_error')}`))).catch(() => { });
            }
            catch (localeError) {
                await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.v2Text)('❌ An error occurred while processing your request.'))).catch(() => { });
            }
        }
    }
};
const event = {
    name: discord_js_1.default.Events.InteractionCreate,
    execute: async (interaction, client) => {
        if (!validateChartButtonInteraction(interaction))
            return;
        await handleChartButtonAction(interaction, client);
    },
};
exports.default = event;
