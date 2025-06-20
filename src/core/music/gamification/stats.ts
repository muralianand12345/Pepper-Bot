import discord from 'discord.js';

import { XPUserRepo } from './repo';
import { XPManager } from './xp_manager';
import { IUserStats } from '../../../types';
import Formatter from '../../../utils/format';
import { LeaderboardManager } from './leaderboard';

export class StatsManager {
	private static instance: StatsManager;
	private client: discord.Client;
	private userRepo: XPUserRepo;
	private xpManager: XPManager;
	private leaderboardManager: LeaderboardManager;

	private constructor(client: discord.Client) {
		this.client = client;
		this.userRepo = new XPUserRepo();
		this.xpManager = XPManager.getInstance(client);
		this.leaderboardManager = LeaderboardManager.getInstance(client);
	}

	public static getInstance = (client: discord.Client): StatsManager => {
		if (!StatsManager.instance) StatsManager.instance = new StatsManager(client);
		return StatsManager.instance;
	};

	public getUserStats = async (userId: string, guildId?: string): Promise<IUserStats | null> => {
		try {
			const userData = await this.userRepo.getUser(userId);
			if (!userData) return null;

			const totalListeningTime = userData.songs.reduce((total, song) => {
				return total + song.duration * song.played_number;
			}, 0);

			const genreCount: { [key: string]: number } = {};
			userData.songs.forEach((song) => {
				const genre = song.sourceName || 'Unknown';
				genreCount[genre] = (genreCount[genre] || 0) + song.played_number;
			});

			const favoriteGenre = Object.keys(genreCount).reduce((a, b) => (genreCount[a] > genreCount[b] ? a : b), 'None');
			const ranks = await this.leaderboardManager.getUserRank(userId, guildId);
			return { totalXP: userData.totalXP, currentLevel: userData.currentLevel, dailyXP: userData.dailyXP, weeklyXP: userData.weeklyXP, monthlyXP: userData.monthlyXP, streakDays: userData.streakDays, totalListeningTime: Math.floor(totalListeningTime / 1000), totalSongs: userData.songs.length, favoriteGenre, globalRank: ranks.globalRank, guildRank: ranks.guildRank };
		} catch (error) {
			this.client.logger.error(`[STATS] Error getting user stats: ${error}`);
			return null;
		}
	};

	public createStatsEmbed = async (user: discord.User, stats: IUserStats, guildId?: string, locale: string = 'en'): Promise<discord.EmbedBuilder> => {
		const levelInfo = this.xpManager.getLevelInfo(stats.totalXP);
		const progressBar = this.createProgressBar(levelInfo.progress);
		const embed = new discord.EmbedBuilder().setColor('#5865f2').setTitle(`📊 ${user.displayName}'s Music Stats`).setThumbnail(user.displayAvatarURL()).setTimestamp().setFooter({ text: 'Pepper Music XP System', iconURL: this.client.user?.displayAvatarURL() });

		embed.addFields([
			{ name: '🏆 Level & XP', value: `**Level ${stats.currentLevel}**\n` + `${stats.totalXP.toLocaleString()} XP\n` + `${progressBar}\n` + `${levelInfo.xpToNextLevel.toLocaleString()} XP to Level ${levelInfo.currentLevel + 1}`, inline: true },
			{ name: '📈 Rankings', value: `Global: **#${stats.globalRank}**\n` + (stats.guildRank ? `Server: **#${stats.guildRank}**` : 'Server: **Not ranked**'), inline: true },
			{ name: '⚡ Activity', value: `Daily: **${stats.dailyXP}** XP\n` + `Weekly: **${stats.weeklyXP}** XP\n` + `Monthly: **${stats.monthlyXP}** XP`, inline: true },
		]);

		const listeningTime = Formatter.formatListeningTime(stats.totalListeningTime);
		const avgSongLength = stats.totalSongs > 0 ? Formatter.msToTime((stats.totalListeningTime * 1000) / stats.totalSongs) : '0:00:00';

		embed.addFields([
			{ name: '🎵 Music Statistics', value: `**${stats.totalSongs}** songs played\n` + `**${listeningTime}** total listening time\n` + `**${avgSongLength}** average song length\n` + `**${stats.favoriteGenre}** favorite source`, inline: true },
			{ name: '🔥 Streak', value: `**${stats.streakDays}** day${stats.streakDays !== 1 ? 's' : ''}\n` + (stats.streakDays >= 7 ? '🎉 Weekly bonus active!' : stats.streakDays >= 1 ? '📈 Daily bonus active!' : '💭 Start your streak!'), inline: true },
		]);
		const xpRewards = this.xpManager.getXPRewards();
		embed.addFields([{ name: '💎 XP Rewards', value: `Listening: **${xpRewards.LISTEN_PER_MINUTE}** XP/min\n` + `Commands: **${xpRewards.COMMAND_BASIC}-${xpRewards.COMMAND_MUSIC}** XP\n` + `Add to Queue: **${xpRewards.QUEUE_ADD}** XP\n` + `Add Playlist: **${xpRewards.PLAYLIST_ADD}** XP`, inline: false }]);
		return embed;
	};

	private createProgressBar = (progress: number): string => {
		const totalBars = 10;
		const filledBars = Math.floor((progress / 100) * totalBars);
		const emptyBars = totalBars - filledBars;
		return '▬'.repeat(filledBars) + '▬'.repeat(emptyBars) + ` ${Math.round(progress)}%`;
	};

	public getDailyStats = async (limit: number = 10): Promise<Array<{ userId: string; username: string; dailyXP: number; rank: number }>> => {
		try {
			const topDailyUsers = await this.userRepo.getTopDailyUsers(limit);
			const result = [];
			for (let i = 0; i < topDailyUsers.length; i++) {
				const userData = topDailyUsers[i];
				try {
					const user = await this.client.users.fetch(userData.userId).catch(() => null);
					result.push({ userId: userData.userId, username: user?.username || 'Unknown User', dailyXP: userData.dailyXP, rank: i + 1 });
				} catch (error) {
					continue;
				}
			}
			return result;
		} catch (error) {
			this.client.logger.error(`[STATS] Error getting daily stats: ${error}`);
			return [];
		}
	};

	public getWeeklyStats = async (limit: number = 10): Promise<Array<{ userId: string; username: string; weeklyXP: number; rank: number }>> => {
		try {
			const topWeeklyUsers = await this.userRepo.getTopWeeklyUsers(limit);
			const result = [];
			for (let i = 0; i < topWeeklyUsers.length; i++) {
				const userData = topWeeklyUsers[i];
				try {
					const user = await this.client.users.fetch(userData.userId).catch(() => null);
					result.push({ userId: userData.userId, username: user?.username || 'Unknown User', weeklyXP: userData.weeklyXP, rank: i + 1 });
				} catch (error) {
					continue;
				}
			}
			return result;
		} catch (error) {
			this.client.logger.error(`[STATS] Error getting weekly stats: ${error}`);
			return [];
		}
	};

	public resetDailyStats = async (): Promise<void> => {
		try {
			await this.userRepo.resetDailyXP();
			this.client.logger.info('[STATS] Daily XP stats reset completed');
		} catch (error) {
			this.client.logger.error(`[STATS] Error resetting daily stats: ${error}`);
		}
	};

	public resetWeeklyStats = async (): Promise<void> => {
		try {
			await this.userRepo.resetWeeklyXP();
			this.client.logger.info('[STATS] Weekly XP stats reset completed');
		} catch (error) {
			this.client.logger.error(`[STATS] Error resetting weekly stats: ${error}`);
		}
	};

	public resetMonthlyStats = async (): Promise<void> => {
		try {
			await this.userRepo.resetMonthlyXP();
			this.client.logger.info('[STATS] Monthly XP stats reset completed');
		} catch (error) {
			this.client.logger.error(`[STATS] Error resetting monthly stats: ${error}`);
		}
	};
}
