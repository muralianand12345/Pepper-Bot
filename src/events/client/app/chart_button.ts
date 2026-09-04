import discord from 'discord.js';

import { MusicDB } from '../../../core/music';
import Formatter from '../../../utils/format';
import { LocaleDetector } from '../../../core/locales';
import { MusicResponseHandler } from '../../../core/music';
import { BotEvent, ISongs, ChartAnalytics } from '../../../types';
import { createChartButtons, createChartContainer } from '../../../commands/chart';
import { v2, v2Ephemeral, v2Text, withRows } from '../../../utils/v2';

const CHART_BUTTON_IDS = ['chart_refresh', 'chart_export'];
const CHART_SCOPES = ['user', 'guild', 'global'];

const localeDetector = new LocaleDetector();

const validateChartButtonInteraction = (interaction: discord.Interaction): interaction is discord.ButtonInteraction => {
	return interaction.isButton() && CHART_BUTTON_IDS.includes(interaction.customId.split(':')[0]);
};

/**
 * Chart state lives in the custom id (`chart_refresh:<scope>:<limit>`) because a
 * Components V2 message has no embeds to read it back out of.
 */
const parseChartCustomId = (customId: string): { scope: string; limit: number } | null => {
	const [, scope, rawLimit] = customId.split(':');
	if (!scope || !CHART_SCOPES.includes(scope)) return null;
	const limit = Number.parseInt(rawLimit, 10);
	return { scope, limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 10 };
};

const generateChartData = async (scope: string, userId: string, guildId: string | null, limit: number): Promise<{ chartData: ISongs[]; analytics: ChartAnalytics | null }> => {
	switch (scope) {
		case 'user': {
			const [topSongs, analytics] = await Promise.all([MusicDB.getUserTopSongs(userId, limit), MusicDB.getUserMusicAnalytics(userId)]);
			return { chartData: topSongs, analytics };
		}
		case 'guild': {
			if (!guildId) return { chartData: [], analytics: null };
			const [topSongs, analytics] = await Promise.all([MusicDB.getGuildTopSongs(guildId, limit), MusicDB.getGuildMusicAnalytics(guildId)]);
			return { chartData: topSongs, analytics };
		}
		case 'global': {
			const [topSongs, analytics] = await Promise.all([MusicDB.getGlobalTopSongs(limit), MusicDB.getGlobalMusicAnalytics()]);
			return { chartData: topSongs, analytics };
		}
		default:
			return { chartData: [], analytics: null };
	}
};

const createExportData = (chartData: ISongs[]): string => {
	let csvContent = 'Rank,Song Title,Artist,Play Count,Duration,Source,Last Played\n';
	chartData.forEach((song: ISongs, index: number) => {
		const rank = index + 1;
		const title = song.title?.replace(/,/g, ';') || 'Unknown';
		const artist = song.author?.replace(/,/g, ';') || 'Unknown';
		const playCount = song.played_number || 0;
		const duration = Formatter.msToTime(song.duration || 0);
		const source = song.sourceName || 'Unknown';
		const lastPlayed = new Date(song.timestamp).toLocaleDateString();
		csvContent += `${rank},"${title}","${artist}",${playCount},"${duration}","${source}","${lastPlayed}"\n`;
	});
	return csvContent;
};

const refreshChart = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void | discord.InteractionResponse> => {
	const locale = await localeDetector.detectLocale(interaction);
	const t = await localeDetector.getTranslator(interaction);
	const responseHandler = new MusicResponseHandler(client);

	const chartInfo = parseChartCustomId(interaction.customId);
	if (!chartInfo) return await interaction.reply(v2Ephemeral(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale)));

	await interaction.deferUpdate();

	try {
		const { chartData, analytics } = await generateChartData(chartInfo.scope, interaction.user.id, interaction.guildId, chartInfo.limit);

		if (!chartData.length || !analytics) {
			await interaction.editReply(v2(responseHandler.createInfoContainer(t('responses.chart.no_data'))));
			return;
		}

		let chartTitle: string;
		let chartColor: number;

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

		const container = createChartContainer(chartData.slice(0, 10), analytics, `${chartTitle} 🔄`, chartColor, t);
		await interaction.editReply(v2(withRows(container, createChartButtons(client, t, chartInfo.scope, chartInfo.limit, true))));
	} catch (error) {
		client.logger.error(`[CHART_REFRESH] Error: ${error}`);
		await interaction.editReply(v2(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale, true)));
	}
};

const exportChartData = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void | discord.InteractionResponse> => {
	const locale = await localeDetector.detectLocale(interaction);
	const t = await localeDetector.getTranslator(interaction);
	const responseHandler = new MusicResponseHandler(client);

	const chartInfo = parseChartCustomId(interaction.customId);
	if (!chartInfo) return await interaction.reply(v2Ephemeral(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale)));

	await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

	try {
		const { chartData } = await generateChartData(chartInfo.scope, interaction.user.id, interaction.guildId, 50);

		if (!chartData.length) {
			const container = responseHandler.createInfoContainer(t('responses.chart.no_data'));
			await interaction.editReply(v2(container));
			return;
		}

		const csvData = createExportData(chartData);
		const buffer = Buffer.from(csvData, 'utf-8');
		const filename = `music-chart-${chartInfo.scope}-${Date.now()}.csv`;
		const attachment = new discord.AttachmentBuilder(buffer, { name: filename });
		const container = responseHandler.createSuccessContainer(`📊 ${t('responses.chart.export_success', { scope: chartInfo.scope, count: chartData.length })}`);
		await interaction.editReply({ ...v2(container), files: [attachment] });
	} catch (error) {
		client.logger.error(`[CHART_EXPORT] Error: ${error}`);
		const container = responseHandler.createErrorContainer(t('responses.errors.general_error'), locale, true);
		await interaction.editReply(v2(container));
	}
};

const handleChartButtonAction = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
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
	} catch (error) {
		client.logger.error(`[CHART_BUTTON] Error handling button ${interaction.customId}: ${error}`);

		if (!interaction.replied && !interaction.deferred) {
			try {
				const t = await localeDetector.getTranslator(interaction);
				await interaction.reply(v2Ephemeral(v2Text(`❌ ${t('responses.errors.general_error')}`))).catch(() => {});
			} catch (localeError) {
				await interaction.reply(v2Ephemeral(v2Text('❌ An error occurred while processing your request.'))).catch(() => {});
			}
		}
	}
};

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		if (!validateChartButtonInteraction(interaction)) return;
		await handleChartButtonAction(interaction, client);
	},
};

export default event;
