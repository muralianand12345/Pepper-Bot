import discord from 'discord.js';

import { MusicDB } from '../core/music';
import Formatter from '../utils/format';
import { MusicResponseHandler } from '../core/music';
import { Command, ChartAnalytics, ISongs, CommandCategory } from '../types';
import { LocalizationManager, LocaleDetector, TranslatorFunction } from '../core/locales';
import { v2, withRows, subtext, panel } from '../utils/v2';

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const chartCommand: Command = {
	cooldown: 60,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('chart')
		.setDescription('Display music analytics and charts')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.chart.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.chart.description'))
		.addStringOption((option) =>
			option
				.setName('scope')
				.setDescription('Choose the scope for analytics')
				.setNameLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.scope.name'))
				.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.scope.description'))
				.setRequired(true)
				.addChoices({ name: 'Personal', value: 'user', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.user') }, { name: 'Server', value: 'guild', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.guild') }, { name: 'Global', value: 'global', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.global') }),
		)
		.addIntegerOption((option) => option.setName('limit').setDescription('Number of top items to display (5-10)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.limit.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.chart.options.limit.description')).setRequired(false).setMinValue(5).setMaxValue(10)),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		await interaction.deferReply();

		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);

		const scope = interaction.options.getString('scope', true);
		const limit = interaction.options.getInteger('limit') || 5;

		try {
			let chartData: ISongs[] = [];
			let analytics: ChartAnalytics | null = null;
			let chartTitle: string = '';
			let chartColor: number = 0x5865f2;

			switch (scope) {
				case 'user': {
					const [topSongs, userAnalytics] = await Promise.all([MusicDB.getUserTopSongs(interaction.user.id, limit), MusicDB.getUserMusicAnalytics(interaction.user.id)]);

					if (!topSongs.length) {
						const container = responseHandler.createInfoContainer(t('responses.chart.no_user_data'));
						await interaction.editReply(v2(container));
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
						await interaction.editReply(v2(container));
						return;
					}

					const [topSongs, guildAnalytics] = await Promise.all([MusicDB.getGuildTopSongs(interaction.guildId, limit), MusicDB.getGuildMusicAnalytics(interaction.guildId)]);

					if (!topSongs.length) {
						const container = responseHandler.createInfoContainer(t('responses.chart.no_guild_data'));
						await interaction.editReply(v2(container));
						return;
					}

					chartData = topSongs;
					analytics = guildAnalytics;
					chartTitle = t('responses.chart.guild_title', { guild: interaction.guild?.name || 'Server' });
					chartColor = 0xf1c40f;
					break;
				}

				case 'global': {
					const [topSongs, globalAnalytics] = await Promise.all([MusicDB.getGlobalTopSongs(limit), MusicDB.getGlobalMusicAnalytics()]);

					if (!topSongs.length) {
						const container = responseHandler.createInfoContainer(t('responses.chart.no_global_data'));
						await interaction.editReply(v2(container));
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
				await interaction.editReply(v2(container));
				return;
			}

			const container = createChartContainer(chartData, analytics, chartTitle, chartColor, t);
			await interaction.editReply(v2(withRows(container, createChartButtons(client, t, scope, limit))));
		} catch (error) {
			client.logger.error(`[CHART_COMMAND] Error: ${error}`);
			const container = responseHandler.createErrorContainer(t('responses.errors.general_error'), locale, true);
			await interaction.editReply(v2(container));
		}
	},
};

export const createChartContainer = (chartData: ISongs[], analytics: ChartAnalytics, title: string, color: number, t: TranslatorFunction): discord.ContainerBuilder => {
	const container = panel(color, {
		title: `📊 ${title}`,
		body: createAnalyticsOverview(analytics, t),
		thumbnail: chartData.length > 0 ? chartData[0]?.artworkUrl || chartData[0]?.thumbnail || null : null,
	});

	if (chartData.length > 0) {
		container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(createTopTracksSection(chartData, t)));
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(createStatsSection(analytics, t)));
	}

	container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(subtext(`${t('responses.chart.footer')} • <t:${Math.floor(Date.now() / 1000)}:f>`)));
	return container;
};

const createAnalyticsOverview = (analytics: ChartAnalytics, t: TranslatorFunction): string => {
	const totalTimeFormatted = Formatter.formatListeningTime(analytics.totalPlaytime / 1000);
	const avgPlayCount = Math.round(analytics.averagePlayCount * 10) / 10;
	return [`🎵 **${analytics.totalSongs}** ${t('responses.chart.total_tracks')}`, `🎤 **${analytics.uniqueArtists}** ${t('responses.chart.unique_artists')}`, `⏱️ **${totalTimeFormatted}** ${t('responses.chart.total_listening_time')}`, `📈 **${avgPlayCount}** ${t('responses.chart.average_plays')}`, `🔥 **${analytics.recentActivity}** ${t('responses.chart.recent_activity')}`].join('\n');
};

export const createTopTracksSection = (chartData: ISongs[], t: TranslatorFunction): string => {
	const tracksList = chartData
		.map((song, index) => {
			const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
			const title = Formatter.truncateText(song.title, 35);
			const artist = Formatter.truncateText(song.author, 25);
			const plays = song.played_number;
			const duration = Formatter.msToTime(song.duration);
			return `${medal} **${title}** - ${artist}\n└ ${plays} ${t('responses.chart.plays')} • ${duration}`;
		})
		.join('\n\n');
	return `**🎶 ${t('responses.chart.top_tracks')}**\n${tracksList.length > 1500 ? tracksList.substring(0, 1497) + '...' : tracksList}`;
};

export const createStatsSection = (analytics: ChartAnalytics, t: TranslatorFunction): string => {
	const totalHours = Math.round((analytics.totalPlaytime / (1000 * 60 * 60)) * 10) / 10;
	const avgSongLength = analytics.totalSongs > 0 ? Formatter.msToTime(analytics.totalPlaytime / analytics.totalSongs) : '0:00:00';
	return `**⏰ ${t('responses.chart.listening_stats')}**\n${[`${t('responses.chart.total_hours')}: **${totalHours}h**`, `${t('responses.chart.avg_song_length')}: **${avgSongLength}**`, `${t('responses.chart.this_week')}: **${analytics.recentActivity}** ${t('responses.chart.tracks')}`].join('\n')}`;
};

/**
 * Scope and limit ride along in the custom id. A Components V2 message carries no
 * embeds, so the chart button handler can no longer read that state back off the
 * message it is attached to.
 */
export const createChartButtons = (client: discord.Client, t: TranslatorFunction, scope: string, limit: number, refreshDisabled: boolean = false): discord.ActionRowBuilder<discord.ButtonBuilder> => {
	return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
		new discord.ButtonBuilder()
			.setCustomId(`chart_refresh:${scope}:${limit}`)
			.setLabel(t('responses.chart.buttons.refresh'))
			.setStyle(discord.ButtonStyle.Primary)
			.setEmoji('🔄')
			.setDisabled(refreshDisabled),
		new discord.ButtonBuilder().setCustomId(`chart_export:${scope}:${limit}`).setLabel(t('responses.chart.buttons.export')).setStyle(discord.ButtonStyle.Secondary).setEmoji('📊'),
		new discord.ButtonBuilder().setLabel(t('responses.buttons.support_server')).setStyle(discord.ButtonStyle.Link).setURL(client.config.bot.support_server.invite).setEmoji('🔧'),
	);
};

export default chartCommand;
