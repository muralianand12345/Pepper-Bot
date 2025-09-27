import discord from 'discord.js';

import { MusicDB } from '../core/music';
import Formatter from '../utils/format';
import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { Command, ChartAnalytics, ISongs, CommandCategory } from '../types';

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
				.addChoices({ name: 'Personal', value: 'user', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.user') }, { name: 'Server', value: 'guild', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.guild') }, { name: 'Global', value: 'global', name_localizations: localizationManager.getCommandLocalizations('commands.chart.options.scope.choices.global') })
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
			let embedTitle: string = '';
			let embedColor: discord.ColorResolvable = '#5865f2';

			switch (scope) {
				case 'user': {
					const [topSongs, userAnalytics] = await Promise.all([MusicDB.getUserTopSongs(interaction.user.id, limit), MusicDB.getUserMusicAnalytics(interaction.user.id)]);

					if (!topSongs.length) {
						const embed = responseHandler.createInfoEmbed(t('responses.chart.no_user_data'));
						await interaction.editReply({ embeds: [embed] });
						return;
					}

					chartData = topSongs;
					analytics = userAnalytics;
					embedTitle = t('responses.chart.user_title', { user: interaction.user.displayName });
					embedColor = '#43b581';
					break;
				}

				case 'guild': {
					if (!interaction.guildId) {
						const embed = responseHandler.createErrorEmbed(t('responses.errors.server_only'), locale);
						await interaction.editReply({ embeds: [embed] });
						return;
					}

					const [topSongs, guildAnalytics] = await Promise.all([MusicDB.getGuildTopSongs(interaction.guildId, limit), MusicDB.getGuildMusicAnalytics(interaction.guildId)]);

					if (!topSongs.length) {
						const embed = responseHandler.createInfoEmbed(t('responses.chart.no_guild_data'));
						await interaction.editReply({ embeds: [embed] });
						return;
					}

					chartData = topSongs;
					analytics = guildAnalytics;
					embedTitle = t('responses.chart.guild_title', { guild: interaction.guild?.name || 'Server' });
					embedColor = '#f1c40f';
					break;
				}

				case 'global': {
					const [topSongs, globalAnalytics] = await Promise.all([MusicDB.getGlobalTopSongs(limit), MusicDB.getGlobalMusicAnalytics()]);

					if (!topSongs.length) {
						const embed = responseHandler.createInfoEmbed(t('responses.chart.no_global_data'));
						await interaction.editReply({ embeds: [embed] });
						return;
					}

					chartData = topSongs;
					analytics = globalAnalytics;
					embedTitle = t('responses.chart.global_title');
					embedColor = '#e74c3c';
					break;
				}
			}

			if (!analytics) {
				client.logger.error(`[CHART_COMMAND] No analytics data found for scope: ${scope}`);
				const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale, true);
				await interaction.editReply({ embeds: [embed] });
				return;
			}

			const embed = createChartEmbed(chartData, analytics, embedTitle, embedColor, t, client);
			const actionRow = createChartButtons(t);
			await interaction.editReply({ embeds: [embed], components: [actionRow] });
		} catch (error) {
			client.logger.error(`[CHART_COMMAND] Error: ${error}`);
			const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale, true);
			await interaction.editReply({ embeds: [embed] });
		}
	},
};

const createChartEmbed = (chartData: ISongs[], analytics: ChartAnalytics, title: string, color: discord.ColorResolvable, t: (key: string, data?: Record<string, any>) => string, client: discord.Client): discord.EmbedBuilder => {
	const embed = new discord.EmbedBuilder()
		.setColor(color)
		.setTitle(`📊 ${title}`)
		.setDescription(createAnalyticsOverview(analytics, t))
		.setTimestamp()
		.setFooter({ text: t('responses.chart.footer'), iconURL: client.user?.displayAvatarURL() });

	if (chartData.length > 0) {
		const topTracksField = createTopTracksField(chartData, t);
		embed.addFields([topTracksField]);
		const statsFields = createStatsFields(analytics, t);
		embed.addFields(statsFields);
		if (chartData[0]?.artworkUrl || chartData[0]?.thumbnail) embed.setThumbnail(chartData[0].artworkUrl || chartData[0].thumbnail);
	}

	return embed;
};

const createAnalyticsOverview = (analytics: ChartAnalytics, t: (key: string, data?: Record<string, any>) => string): string => {
	const totalTimeFormatted = Formatter.formatListeningTime(analytics.totalPlaytime / 1000);
	const avgPlayCount = Math.round(analytics.averagePlayCount * 10) / 10;
	return [`🎵 **${analytics.totalSongs}** ${t('responses.chart.total_tracks')}`, `🎤 **${analytics.uniqueArtists}** ${t('responses.chart.unique_artists')}`, `⏱️ **${totalTimeFormatted}** ${t('responses.chart.total_listening_time')}`, `📈 **${avgPlayCount}** ${t('responses.chart.average_plays')}`, `🔥 **${analytics.recentActivity}** ${t('responses.chart.recent_activity')}`].join('\n');
};

const createTopTracksField = (chartData: ISongs[], t: (key: string, data?: Record<string, any>) => string) => {
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
	return { name: `🎶 ${t('responses.chart.top_tracks')}`, value: tracksList.length > 1024 ? tracksList.substring(0, 1021) + '...' : tracksList, inline: false };
};

const createStatsFields = (analytics: ChartAnalytics, t: (key: string, data?: Record<string, any>) => string) => {
	const fields = [];
	const totalHours = Math.round((analytics.totalPlaytime / (1000 * 60 * 60)) * 10) / 10;
	const avgSongLength = analytics.totalSongs > 0 ? Formatter.msToTime(analytics.totalPlaytime / analytics.totalSongs) : '0:00:00';
	fields.push({ name: `⏰ ${t('responses.chart.listening_stats')}`, value: [`${t('responses.chart.total_hours')}: **${totalHours}h**`, `${t('responses.chart.avg_song_length')}: **${avgSongLength}**`, `${t('responses.chart.this_week')}: **${analytics.recentActivity}** ${t('responses.chart.tracks')}`].join('\n'), inline: true });
	return fields;
};

const createChartButtons = (t: (key: string, data?: Record<string, any>) => string): discord.ActionRowBuilder<discord.ButtonBuilder> => {
	return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
		new discord.ButtonBuilder().setCustomId('chart_refresh').setLabel(t('responses.chart.buttons.refresh')).setStyle(discord.ButtonStyle.Primary).setEmoji('🔄'),
		new discord.ButtonBuilder().setCustomId('chart_export').setLabel(t('responses.chart.buttons.export')).setStyle(discord.ButtonStyle.Secondary).setEmoji('📊'),
		new discord.ButtonBuilder().setLabel(t('responses.buttons.support_server')).setStyle(discord.ButtonStyle.Link).setURL('https://discord.gg/XzE9hSbsNb').setEmoji('🔧')
	);
};

export default chartCommand;
