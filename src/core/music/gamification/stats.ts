import discord from 'discord.js';

import { UserStats, LevelInfo, XPRewards } from '../../../types';

export class StatsManager {
	private static instance: StatsManager;
	private client: discord.Client;
	private xpManager: any;
	private userRepo: any;

	constructor(client: discord.Client) {
		this.client = client;
	}

	static getInstance = (client: discord.Client): StatsManager => {
		if (!StatsManager.instance) StatsManager.instance = new StatsManager(client);
		return StatsManager.instance;
	};

	getUserStats = async (userId: string, guildId?: string): Promise<UserStats | null> => {
		try {
			const stats = await this.userRepo.getUserStats(userId, guildId);
			if (!stats) return null;

			return {
				userId: stats.userId || userId,
				guildId: stats.guildId || guildId,
				totalXP: Number(stats.totalXP) || 0,
				currentLevel: Number(stats.currentLevel) || 1,
				dailyXP: Number(stats.dailyXP) || 0,
				weeklyXP: Number(stats.weeklyXP) || 0,
				monthlyXP: Number(stats.monthlyXP) || 0,
				totalSongs: Number(stats.totalSongs) || 0,
				totalListeningTime: Number(stats.totalListeningTime) || 0,
				favoriteGenre: stats.favoriteGenre || 'Unknown',
				streakDays: Number(stats.streakDays) || 0,
				globalRank: Number(stats.globalRank) || 0,
				guildRank: stats.guildRank ? Number(stats.guildRank) : undefined,
				lastActive: stats.lastActive || new Date(),
			};
		} catch (error) {
			this.client.logger?.error(`[STATS_MANAGER] Error fetching user stats: ${error}`);
			return null;
		}
	};

	createStatsEmbed = async (user: discord.User, stats: UserStats, guildId?: string, locale: string = 'en'): Promise<discord.EmbedBuilder> => {
		const safeStats = this.validateStats(stats);
		const levelInfo = this.xpManager.getLevelInfo(safeStats.totalXP);
		const safeLevelInfo = this.validateLevelInfo(levelInfo);
		const progressBar = this.createProgressBar(safeLevelInfo.progress);

		const embed = new discord.EmbedBuilder().setColor('#5865f2').setTitle(`📊 ${user.displayName}'s Music Stats`).setThumbnail(user.displayAvatarURL()).setTimestamp().setFooter({ text: 'Pepper Music XP System', iconURL: this.client.user?.displayAvatarURL() });

		embed.addFields([
			{ name: '🏆 Level & XP', value: `**Level ${safeStats.currentLevel}**\n` + `${safeStats.totalXP.toLocaleString(locale)} XP\n` + `${progressBar}\n` + `${safeLevelInfo.xpToNextLevel.toLocaleString(locale)} XP to Level ${safeLevelInfo.currentLevel + 1}`, inline: true },
			{ name: '📈 Rankings', value: `Global: **#${safeStats.globalRank || 'Unranked'}**\n` + (safeStats.guildRank ? `Server: **#${safeStats.guildRank}**` : 'Server: **Not ranked**'), inline: true },
			{ name: '⚡ Activity', value: `Daily: **${safeStats.dailyXP.toLocaleString(locale)}** XP\n` + `Weekly: **${safeStats.weeklyXP.toLocaleString(locale)}** XP\n` + `Monthly: **${safeStats.monthlyXP.toLocaleString(locale)}** XP`, inline: true },
		]);

		const listeningTime = this.formatListeningTime(safeStats.totalListeningTime);
		const avgSongLength = safeStats.totalSongs > 0 ? this.msToTime((safeStats.totalListeningTime * 1000) / safeStats.totalSongs) : '0:00:00';

		embed.addFields([
			{ name: '🎵 Music Statistics', value: `**${safeStats.totalSongs.toLocaleString(locale)}** songs played\n` + `**${listeningTime}** total listening time\n` + `**${avgSongLength}** average song length\n` + `**${safeStats.favoriteGenre}** favorite source`, inline: true },
			{ name: '🔥 Streak', value: `**${safeStats.streakDays}** day${safeStats.streakDays !== 1 ? 's' : ''}\n` + (safeStats.streakDays >= 7 ? '🎉 Weekly bonus active!' : safeStats.streakDays >= 1 ? '📈 Daily bonus active!' : '💭 Start your streak!'), inline: true },
		]);

		const xpRewards = this.getXPRewards();
		embed.addFields([{ name: '💎 XP Rewards', value: `Listening: **${xpRewards.LISTEN_PER_MINUTE}** XP/min\n` + `Commands: **${xpRewards.COMMAND_BASIC}-${xpRewards.COMMAND_MUSIC}** XP\n` + `Add to Queue: **${xpRewards.QUEUE_ADD}** XP\n` + `Add Playlist: **${xpRewards.PLAYLIST_ADD}** XP`, inline: false }]);
		return embed;
	};

	private validateStats = (stats: UserStats): UserStats => {
		return {
			userId: stats.userId || '',
			guildId: stats.guildId,
			totalXP: this.safeNumber(stats.totalXP),
			currentLevel: this.safeNumber(stats.currentLevel, 1),
			dailyXP: this.safeNumber(stats.dailyXP),
			weeklyXP: this.safeNumber(stats.weeklyXP),
			monthlyXP: this.safeNumber(stats.monthlyXP),
			totalSongs: this.safeNumber(stats.totalSongs),
			totalListeningTime: this.safeNumber(stats.totalListeningTime),
			favoriteGenre: stats.favoriteGenre || 'Unknown',
			streakDays: this.safeNumber(stats.streakDays),
			globalRank: this.safeNumber(stats.globalRank),
			guildRank: stats.guildRank ? this.safeNumber(stats.guildRank) : undefined,
			lastActive: stats.lastActive || new Date(),
		};
	};

	private validateLevelInfo = (levelInfo: any): LevelInfo => {
		return {
			currentLevel: this.safeNumber(levelInfo?.currentLevel, 1),
			xpToNextLevel: this.safeNumber(levelInfo?.xpToNextLevel),
			progress: this.safeNumber(levelInfo?.progress),
			xpForCurrentLevel: this.safeNumber(levelInfo?.xpForCurrentLevel),
			xpRequiredForNext: this.safeNumber(levelInfo?.xpRequiredForNext, 100),
		};
	};

	private safeNumber = (value: any, fallback: number = 0): number => {
		const num = Number(value);
		return isNaN(num) || !isFinite(num) ? fallback : num;
	};

	private createProgressBar = (progress: number): string => {
		const safeProgress = this.safeNumber(progress);
		const totalBars = 10;
		const filledBars = Math.floor((safeProgress / 100) * totalBars);
		const emptyBars = totalBars - filledBars;
		return '▬'.repeat(filledBars) + '▬'.repeat(emptyBars) + ` ${Math.round(safeProgress)}%`;
	};

	private formatListeningTime = (milliseconds: number): string => {
		const safeMs = this.safeNumber(milliseconds);
		if (safeMs === 0) return '0h 0m';
		const hours = Math.floor(safeMs / (1000 * 60 * 60));
		const minutes = Math.floor((safeMs % (1000 * 60 * 60)) / (1000 * 60));
		if (hours === 0) return `${minutes}m`;
		return `${hours}h ${minutes}m`;
	};

	private msToTime = (duration: number): string => {
		const safeDuration = this.safeNumber(duration);
		if (safeDuration === 0) return '0:00:00';
		const seconds = Math.floor((safeDuration / 1000) % 60);
		const minutes = Math.floor((safeDuration / (1000 * 60)) % 60);
		const hours = Math.floor((safeDuration / (1000 * 60 * 60)) % 24);
		return [hours, minutes, seconds].map((val) => (val < 10 ? `0${val}` : val)).join(':');
	};

	private getXPRewards = (): XPRewards => {
		return this.xpManager?.getXPRewards() || { LISTEN_PER_MINUTE: 5, COMMAND_BASIC: 2, COMMAND_MUSIC: 5, QUEUE_ADD: 10, PLAYLIST_ADD: 25 };
	};

	getDailyStats = async (limit: number = 10): Promise<Array<{ userId: string; username: string; dailyXP: number; rank: number }>> => {
		try {
			const topDailyUsers = await this.userRepo.getTopDailyUsers(limit);
			const result = [];
			for (let i = 0; i < topDailyUsers.length; i++) {
				const userData = topDailyUsers[i];
				result.push({ userId: userData.userId || '', username: userData.username || 'Unknown User', dailyXP: this.safeNumber(userData.dailyXP), rank: i + 1 });
			}
			return result;
		} catch (error) {
			this.client.logger?.error(`[STATS_MANAGER] Error fetching daily stats: ${error}`);
			return [];
		}
	};

	getWeeklyStats = async (limit: number = 10): Promise<Array<{ userId: string; username: string; weeklyXP: number; rank: number }>> => {
		try {
			const topWeeklyUsers = await this.userRepo.getTopWeeklyUsers(limit);
			const result = [];
			for (let i = 0; i < topWeeklyUsers.length; i++) {
				const userData = topWeeklyUsers[i];
				result.push({ userId: userData.userId || '', username: userData.username || 'Unknown User', weeklyXP: this.safeNumber(userData.weeklyXP), rank: i + 1 });
			}
			return result;
		} catch (error) {
			this.client.logger?.error(`[STATS_MANAGER] Error fetching weekly stats: ${error}`);
			return [];
		}
	};
}
