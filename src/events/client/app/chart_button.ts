import discord from "discord.js";

import { MusicDB } from "../../../core/music";
import Formatter from "../../../utils/format";
import { BotEvent, ISongs } from "../../../types";
import { LocaleDetector } from "../../../core/locales";
import { MusicResponseHandler } from "../../../core/music";


const CHART_BUTTON_IDS = ["chart_refresh", "chart_export"];

const localeDetector = new LocaleDetector();

const validateChartButtonInteraction = (interaction: discord.Interaction): interaction is discord.ButtonInteraction => {
    return interaction.isButton() && CHART_BUTTON_IDS.includes(interaction.customId);
};

const extractChartDataFromEmbed = (embed: discord.Embed): { scope: string; limit: number } | null => {
    try {
        const title = embed.title || "";
        let scope = "user";

        if (title.includes("Global")) {
            scope = "global";
        } else if (title.includes("Server")) {
            scope = "guild";
        }

        const description = embed.description || "";
        const lines = description.split('\n');
        const totalTracksLine = lines.find(line => line.includes("total tracks"));

        let limit = 10;
        if (totalTracksLine) {
            const match = totalTracksLine.match(/\*\*(\d+)\*\*/);
            if (match) limit = Math.min(parseInt(match[1]), 20);
        }

        return { scope, limit };
    } catch (error) {
        return null;
    }
};

const generateChartData = async (scope: string, userId: string, guildId: string | null, limit: number): Promise<ISongs[]> => {
    switch (scope) {
        case "user": {
            const userHistory = await MusicDB.getUserMusicHistory(userId);
            return userHistory?.songs?.sort((a, b) => (b.played_number || 0) - (a.played_number || 0)).slice(0, limit) || [];
        }
        case "guild": {
            if (!guildId) return [];
            const guildHistory = await MusicDB.getGuildMusicHistory(guildId);
            return guildHistory?.songs?.sort((a, b) => (b.played_number || 0) - (a.played_number || 0)).slice(0, limit) || [];
        }
        case "global": {
            const globalHistory = await MusicDB.getGlobalMusicHistory();
            return globalHistory?.songs?.sort((a, b) => (b.played_number || 0) - (a.played_number || 0)).slice(0, limit) || [];
        }
        default:
            return [];
    }
};

const createExportData = (chartData: ISongs[], scope: string, username: string, guildName?: string): string => {
    let csvContent = "Rank,Song Title,Artist,Play Count,Duration,Source,Last Played\n";
    chartData.forEach((song: ISongs, index: number) => {
        const rank = index + 1;
        const title = song.title?.replace(/,/g, ';') || "Unknown";
        const artist = song.author?.replace(/,/g, ';') || "Unknown";
        const playCount = song.played_number || 0;
        const duration = Formatter.msToTime(song.duration || 0);
        const source = song.sourceName || "Unknown";
        const lastPlayed = new Date(song.timestamp).toLocaleDateString();
        csvContent += `${rank},"${title}","${artist}",${playCount},"${duration}","${source}","${lastPlayed}"\n`;
    });
    return csvContent;
};

const refreshChartEmbed = async (interaction: discord.ButtonInteraction, originalEmbed: discord.Embed, client: discord.Client): Promise<void | discord.InteractionResponse> => {
    const locale = await localeDetector.detectLocale(interaction);
    const t = await localeDetector.getTranslator(interaction);
    const responseHandler = new MusicResponseHandler(client);

    const chartInfo = extractChartDataFromEmbed(originalEmbed);
    if (!chartInfo) {
        const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale);
        return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();

    try {
        const chartData = await generateChartData(chartInfo.scope, interaction.user.id, interaction.guildId, chartInfo.limit);

        if (!chartData.length) {
            const embed = responseHandler.createInfoEmbed(t('responses.chart.no_data'), locale);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const analytics = {
            totalSongs: chartData.length,
            uniqueArtists: new Set(chartData.map(song => song.author?.toLowerCase())).size,
            totalPlaytime: chartData.reduce((acc, song) => acc + (song.duration * song.played_number), 0),
            topGenres: {},
            recentActivity: chartData.filter(song => {
                const songDate = new Date(song.timestamp);
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return songDate > weekAgo;
            }).length,
            averagePlayCount: chartData.reduce((acc, song) => acc + song.played_number, 0) / chartData.length || 0
        };

        const genres: { [key: string]: number } = {};
        chartData.forEach((song: ISongs) => {
            if (song.sourceName) genres[song.sourceName] = (genres[song.sourceName] || 0) + song.played_number;
        });
        analytics.topGenres = genres;

        let embedTitle: string;
        let embedColor: discord.ColorResolvable;

        switch (chartInfo.scope) {
            case "user":
                embedTitle = t('responses.chart.user_title', { user: interaction.user.displayName });
                embedColor = "#43b581";
                break;
            case "guild":
                embedTitle = t('responses.chart.guild_title', { guild: interaction.guild?.name || 'Server' });
                embedColor = "#f1c40f";
                break;
            case "global":
                embedTitle = t('responses.chart.global_title');
                embedColor = "#e74c3c";
                break;
            default:
                embedTitle = "Music Chart";
                embedColor = "#5865f2";
        }

        const totalTimeFormatted = Formatter.formatListeningTime(analytics.totalPlaytime / 1000);
        const avgPlayCount = Math.round(analytics.averagePlayCount * 10) / 10;

        const description = [
            `🎵 **${analytics.totalSongs}** ${t('responses.chart.total_tracks')}`,
            `🎤 **${analytics.uniqueArtists}** ${t('responses.chart.unique_artists')}`,
            `⏱️ **${totalTimeFormatted}** ${t('responses.chart.total_listening_time')}`,
            `📈 **${avgPlayCount}** ${t('responses.chart.average_plays')}`,
            `🔥 **${analytics.recentActivity}** ${t('responses.chart.recent_activity')}`
        ].join('\n');

        const tracksList = chartData.slice(0, 10).map((song, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
            const title = Formatter.truncateText(song.title, 35);
            const artist = Formatter.truncateText(song.author, 25);
            const plays = song.played_number;
            const duration = Formatter.msToTime(song.duration);

            return `${medal} **${title}** - ${artist}\n└ ${plays} ${t('responses.chart.plays')} • ${duration}`;
        }).join('\n\n');

        const totalHours = Math.round(analytics.totalPlaytime / (1000 * 60 * 60) * 10) / 10;
        const avgSongLength = analytics.totalSongs > 0 ? Formatter.msToTime(analytics.totalPlaytime / analytics.totalSongs) : "0:00:00";

        const embed = new discord.EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`📊 ${embedTitle} 🔄`)
            .setDescription(description)
            .addFields([
                { name: `🎶 ${t('responses.chart.top_tracks')}`, value: tracksList.length > 1024 ? tracksList.substring(0, 1021) + "..." : tracksList, inline: false },
                { name: `⏰ ${t('responses.chart.listening_stats')}`, value: [`${t('responses.chart.total_hours')}: **${totalHours}h**`, `${t('responses.chart.avg_song_length')}: **${avgSongLength}**`, `${t('responses.chart.this_week')}: **${analytics.recentActivity}** ${t('responses.chart.tracks')}`].join('\n'), inline: true }
            ])
            .setTimestamp()
            .setFooter({ text: `${t('responses.chart.footer')} • ${t('responses.chart.buttons.refresh')}ed`, iconURL: client.user?.displayAvatarURL() });

        if (chartData[0]?.artworkUrl || chartData[0]?.thumbnail) embed.setThumbnail(chartData[0].artworkUrl || chartData[0].thumbnail);

        const actionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>()
            .addComponents(
                new discord.ButtonBuilder()
                    .setCustomId("chart_refresh")
                    .setLabel(t('responses.chart.buttons.refresh'))
                    .setStyle(discord.ButtonStyle.Primary)
                    .setEmoji("🔄"),
                new discord.ButtonBuilder()
                    .setCustomId("chart_export")
                    .setLabel(t('responses.chart.buttons.export'))
                    .setStyle(discord.ButtonStyle.Secondary)
                    .setEmoji("📊"),
                new discord.ButtonBuilder()
                    .setLabel(t('responses.buttons.support_server'))
                    .setStyle(discord.ButtonStyle.Link)
                    .setURL("https://discord.gg/XzE9hSbsNb")
                    .setEmoji("🔧")
            );

        await interaction.editReply({ embeds: [embed], components: [actionRow] });

    } catch (error) {
        client.logger.error(`[CHART_REFRESH] Error: ${error}`);
        const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale, true);
        await interaction.editReply({ embeds: [embed] });
    }
};

const exportChartData = async (interaction: discord.ButtonInteraction, originalEmbed: discord.Embed, client: discord.Client): Promise<void | discord.InteractionResponse> => {
    const locale = await localeDetector.detectLocale(interaction);
    const t = await localeDetector.getTranslator(interaction);
    const responseHandler = new MusicResponseHandler(client);

    const chartInfo = extractChartDataFromEmbed(originalEmbed);
    if (!chartInfo) {
        const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale);
        return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

    try {
        const chartData = await generateChartData(chartInfo.scope, interaction.user.id, interaction.guildId, 50);

        if (!chartData.length) {
            const embed = responseHandler.createInfoEmbed(t('responses.chart.no_data'), locale);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const csvData = createExportData(chartData, chartInfo.scope, interaction.user.displayName, interaction.guild?.name);
        const buffer = Buffer.from(csvData, 'utf-8');
        const filename = `music-chart-${chartInfo.scope}-${Date.now()}.csv`;
        const attachment = new discord.AttachmentBuilder(buffer, { name: filename });
        const embed = responseHandler.createSuccessEmbed(`📊 ${t('responses.chart.export_success', { scope: chartInfo.scope, count: chartData.length })}`, locale);
        await interaction.editReply({ embeds: [embed], files: [attachment] });

    } catch (error) {
        client.logger.error(`[CHART_EXPORT] Error: ${error}`);
        const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale, true);
        await interaction.editReply({ embeds: [embed] });
    }
};

const handleChartButtonAction = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
    try {
        const originalMessage = interaction.message;
        const originalEmbed = originalMessage.embeds[0];

        if (!originalEmbed) {
            const locale = await localeDetector.detectLocale(interaction);
            const t = await localeDetector.getTranslator(interaction);
            const responseHandler = new MusicResponseHandler(client);
            const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale);
            await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
            return;
        }

        switch (interaction.customId) {
            case "chart_refresh":
                await refreshChartEmbed(interaction, originalEmbed, client);
                break;
            case "chart_export":
                await exportChartData(interaction, originalEmbed, client);
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
                const message = t('responses.errors.general_error');

                await interaction.reply({ content: `❌ ${message}`, flags: discord.MessageFlags.Ephemeral }).catch(() => { });
            } catch (localeError) {
                await interaction.reply({ content: "❌ An error occurred while processing your request.", flags: discord.MessageFlags.Ephemeral }).catch(() => { });
            }
        }
    }
};

const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
        if (!validateChartButtonInteraction(interaction)) return;
        await handleChartButtonAction(interaction, client);
    }
};

export default event;