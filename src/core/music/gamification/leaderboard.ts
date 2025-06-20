import discord from 'discord.js';

import { XPManager } from './xp_manager';
import { XPUserRepo, XPGuildRepo } from './repo';
import { ILeaderboardEntry } from '../../../types';

export class LeaderboardManager {
	private static instance: LeaderboardManager;
	private client: discord.Client;
	private userRepo: XPUserRepo;
	private guildRepo: XPGuildRepo;
	private xpManager: XPManager;
	private globalLeaderboardCache: ILeaderboardEntry[] = [];
	private guildLeaderboardCache: Map<string, ILeaderboardEntry[]> = new Map();
	private lastGlobalUpdate: number = 0;
	private lastGuildUpdate: Map<string, number> = new Map();
	private readonly CACHE_DURATION = 5 * 60 * 1000;

	private constructor(client: discord.Client) {
		this.client = client;
		this.userRepo = new XPUserRepo();
		this.guildRepo = new XPGuildRepo();
		this.xpManager = XPManager.getInstance(client);
	}

	public static getInstance = (client: discord.Client): LeaderboardManager => {
		if (!LeaderboardManager.instance) LeaderboardManager.instance = new LeaderboardManager(client);
		return LeaderboardManager.instance;
	};

	public getGlobalLeaderboard = async (limit: number = 10): Promise<ILeaderboardEntry[]> => {
		const now = Date.now();
		if (this.globalLeaderboardCache.length > 0 && now - this.lastGlobalUpdate < this.CACHE_DURATION) return this.globalLeaderboardCache.slice(0, limit);

		try {
			const topUsers = await this.userRepo.getTopUsers(100);
			const leaderboard: ILeaderboardEntry[] = [];

			for (let i = 0; i < topUsers.length; i++) {
				const userData = topUsers[i];
				try {
					const user = await this.client.users.fetch(userData.userId).catch(() => null);

					leaderboard.push({ userId: userData.userId, username: user?.username || 'Unknown User', avatar: user?.displayAvatarURL() || undefined, totalXP: userData.totalXP, currentLevel: userData.currentLevel, rank: i + 1 });
				} catch (error) {
					continue;
				}
			}

			this.globalLeaderboardCache = leaderboard;
			this.lastGlobalUpdate = now;
			return leaderboard.slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[LEADERBOARD] Error fetching global leaderboard: ${error}`);
			return [];
		}
	};

	public getGuildLeaderboard = async (guildId: string, limit: number = 10): Promise<ILeaderboardEntry[]> => {
		const now = Date.now();
		const lastUpdate = this.lastGuildUpdate.get(guildId) || 0;

		if (this.guildLeaderboardCache.has(guildId) && now - lastUpdate < this.CACHE_DURATION) return this.guildLeaderboardCache.get(guildId)!.slice(0, limit);

		try {
			const guild = this.client.guilds.cache.get(guildId);
			if (!guild) return [];

			const topUsers = await this.userRepo.getTopUsers(50);
			const guildLeaderboard: ILeaderboardEntry[] = [];

			for (let i = 0; i < topUsers.length; i++) {
				const userData = topUsers[i];

				try {
					const member = guild.members.cache.get(userData.userId) || (await guild.members.fetch(userData.userId).catch(() => null));
					if (member) guildLeaderboard.push({ userId: userData.userId, username: member.user.username, avatar: member.user.displayAvatarURL(), totalXP: userData.totalXP, currentLevel: userData.currentLevel, rank: guildLeaderboard.length + 1, guildId: guildId });
				} catch (error) {
					continue;
				}
				if (guildLeaderboard.length >= 50) break;
			}

			this.guildLeaderboardCache.set(guildId, guildLeaderboard);
			this.lastGuildUpdate.set(guildId, now);

			return guildLeaderboard.slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[LEADERBOARD] Error fetching guild leaderboard: ${error}`);
			return [];
		}
	};

	public getUserRank = async (userId: string, guildId?: string): Promise<{ globalRank: number; guildRank?: number }> => {
		try {
			const [globalRank, guildRank] = await Promise.all([this.userRepo.getUserGlobalRank(userId), guildId ? this.getUserGuildRank(userId, guildId) : Promise.resolve(undefined)]);
			return { globalRank: globalRank || 0, guildRank: guildRank || undefined };
		} catch (error) {
			this.client.logger.error(`[LEADERBOARD] Error getting user rank: ${error}`);
			return { globalRank: 0 };
		}
	};

	private getUserGuildRank = async (userId: string, guildId: string): Promise<number> => {
		try {
			const guildLeaderboard = await this.getGuildLeaderboard(guildId, 100);
			const userEntry = guildLeaderboard.find((entry) => entry.userId === userId);
			return userEntry?.rank || 0;
		} catch (error) {
			return 0;
		}
	};

	public createLeaderboardEmbed = async (leaderboard: ILeaderboardEntry[], type: 'global' | 'guild', guildName?: string, locale: string = 'en'): Promise<discord.EmbedBuilder> => {
		const title = type === 'global' ? '🌍 Global XP Leaderboard' : `🏆 ${guildName || 'Server'} XP Leaderboard`;
		const embed = new discord.EmbedBuilder().setColor('#ffd700').setTitle(title).setTimestamp().setFooter({ text: 'Pepper Music XP System', iconURL: this.client.user?.displayAvatarURL() });
		if (leaderboard.length === 0) {
			embed.setDescription('No users found in the leaderboard yet. Start listening to music to appear here!');
			return embed;
		}

		const description = leaderboard
			.map((entry, index) => {
				const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${entry.rank}.**`;
				const levelInfo = this.xpManager.getLevelInfo(entry.totalXP);
				return `${medal} **${entry.username}**\n` + `└ Level ${entry.currentLevel} • ${entry.totalXP.toLocaleString()} XP`;
			})
			.join('\n\n');

		embed.setDescription(description);

		const totalUsers = leaderboard.length;
		const totalXP = leaderboard.reduce((sum, entry) => sum + entry.totalXP, 0);
		const avgLevel = Math.round(leaderboard.reduce((sum, entry) => sum + entry.currentLevel, 0) / totalUsers);
		embed.addFields([{ name: '📊 Statistics', value: `**${totalUsers}** users • **${totalXP.toLocaleString()}** total XP • **Level ${avgLevel}** average`, inline: false }]);
		return embed;
	};

	public clearCache = (guildId?: string): void => {
		if (guildId) {
			this.guildLeaderboardCache.delete(guildId);
			this.lastGuildUpdate.delete(guildId);
		} else {
			this.globalLeaderboardCache = [];
			this.lastGlobalUpdate = 0;
			this.guildLeaderboardCache.clear();
			this.lastGuildUpdate.clear();
		}
	};

	public getTopGuilds = async (limit: number = 10): Promise<Array<{ guildId: string; guildName: string; totalXP: number; activeMembers: number; rank: number }>> => {
		try {
			const topGuilds = await this.guildRepo.getTopGuilds(limit);
			const result = [];

			for (let i = 0; i < topGuilds.length; i++) {
				const guildData = topGuilds[i];
				const guild = this.client.guilds.cache.get(guildData.guildId);
				result.push({ guildId: guildData.guildId, guildName: guild?.name || 'Unknown Server', totalXP: guildData.totalGuildXP, activeMembers: guildData.activeMembers, rank: i + 1 });
			}

			return result;
		} catch (error) {
			this.client.logger.error(`[LEADERBOARD] Error fetching top guilds: ${error}`);
			return [];
		}
	};
}
