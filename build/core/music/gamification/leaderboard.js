"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardManager = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const xp_manager_1 = require("./xp_manager");
const repo_1 = require("./repo");
class LeaderboardManager {
    constructor(client) {
        this.globalLeaderboardCache = [];
        this.guildLeaderboardCache = new Map();
        this.lastGlobalUpdate = 0;
        this.lastGuildUpdate = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000;
        this.getGlobalLeaderboard = async (limit = 10) => {
            const now = Date.now();
            if (this.globalLeaderboardCache.length > 0 && now - this.lastGlobalUpdate < this.CACHE_DURATION)
                return this.globalLeaderboardCache.slice(0, limit);
            try {
                const topUsers = await this.userRepo.getTopUsers(100);
                const leaderboard = [];
                for (let i = 0; i < topUsers.length; i++) {
                    const userData = topUsers[i];
                    try {
                        const user = await this.client.users.fetch(userData.userId).catch(() => null);
                        leaderboard.push({ userId: userData.userId, username: user?.username || 'Unknown User', avatar: user?.displayAvatarURL() || undefined, totalXP: userData.totalXP, currentLevel: userData.currentLevel, rank: i + 1 });
                    }
                    catch (error) {
                        continue;
                    }
                }
                this.globalLeaderboardCache = leaderboard;
                this.lastGlobalUpdate = now;
                return leaderboard.slice(0, limit);
            }
            catch (error) {
                this.client.logger.error(`[LEADERBOARD] Error fetching global leaderboard: ${error}`);
                return [];
            }
        };
        this.getGuildLeaderboard = async (guildId, limit = 10) => {
            const now = Date.now();
            const lastUpdate = this.lastGuildUpdate.get(guildId) || 0;
            if (this.guildLeaderboardCache.has(guildId) && now - lastUpdate < this.CACHE_DURATION)
                return this.guildLeaderboardCache.get(guildId).slice(0, limit);
            try {
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild)
                    return [];
                const topUsers = await this.userRepo.getTopUsers(50);
                const guildLeaderboard = [];
                for (let i = 0; i < topUsers.length; i++) {
                    const userData = topUsers[i];
                    try {
                        const member = guild.members.cache.get(userData.userId) || (await guild.members.fetch(userData.userId).catch(() => null));
                        if (member)
                            guildLeaderboard.push({ userId: userData.userId, username: member.user.username, avatar: member.user.displayAvatarURL(), totalXP: userData.totalXP, currentLevel: userData.currentLevel, rank: guildLeaderboard.length + 1, guildId: guildId });
                    }
                    catch (error) {
                        continue;
                    }
                    if (guildLeaderboard.length >= 50)
                        break;
                }
                this.guildLeaderboardCache.set(guildId, guildLeaderboard);
                this.lastGuildUpdate.set(guildId, now);
                return guildLeaderboard.slice(0, limit);
            }
            catch (error) {
                this.client.logger.error(`[LEADERBOARD] Error fetching guild leaderboard: ${error}`);
                return [];
            }
        };
        this.getUserRank = async (userId, guildId) => {
            try {
                const [globalRank, guildRank] = await Promise.all([this.userRepo.getUserGlobalRank(userId), guildId ? this.getUserGuildRank(userId, guildId) : Promise.resolve(undefined)]);
                return { globalRank: globalRank || 0, guildRank: guildRank || undefined };
            }
            catch (error) {
                this.client.logger.error(`[LEADERBOARD] Error getting user rank: ${error}`);
                return { globalRank: 0 };
            }
        };
        this.getUserGuildRank = async (userId, guildId) => {
            try {
                const guildLeaderboard = await this.getGuildLeaderboard(guildId, 100);
                const userEntry = guildLeaderboard.find((entry) => entry.userId === userId);
                return userEntry?.rank || 0;
            }
            catch (error) {
                return 0;
            }
        };
        this.createLeaderboardEmbed = async (leaderboard, type, guildName, locale = 'en') => {
            const title = type === 'global' ? '🌍 Global XP Leaderboard' : `🏆 ${guildName || 'Server'} XP Leaderboard`;
            const embed = new discord_js_1.default.EmbedBuilder().setColor('#ffd700').setTitle(title).setTimestamp().setFooter({ text: 'Pepper Music XP System', iconURL: this.client.user?.displayAvatarURL() });
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
        this.clearCache = (guildId) => {
            if (guildId) {
                this.guildLeaderboardCache.delete(guildId);
                this.lastGuildUpdate.delete(guildId);
            }
            else {
                this.globalLeaderboardCache = [];
                this.lastGlobalUpdate = 0;
                this.guildLeaderboardCache.clear();
                this.lastGuildUpdate.clear();
            }
        };
        this.getTopGuilds = async (limit = 10) => {
            try {
                const topGuilds = await this.guildRepo.getTopGuilds(limit);
                const result = [];
                for (let i = 0; i < topGuilds.length; i++) {
                    const guildData = topGuilds[i];
                    const guild = this.client.guilds.cache.get(guildData.guildId);
                    result.push({ guildId: guildData.guildId, guildName: guild?.name || 'Unknown Server', totalXP: guildData.totalGuildXP, activeMembers: guildData.activeMembers, rank: i + 1 });
                }
                return result;
            }
            catch (error) {
                this.client.logger.error(`[LEADERBOARD] Error fetching top guilds: ${error}`);
                return [];
            }
        };
        this.client = client;
        this.userRepo = new repo_1.XPUserRepo();
        this.guildRepo = new repo_1.XPGuildRepo();
        this.xpManager = xp_manager_1.XPManager.getInstance(client);
    }
}
exports.LeaderboardManager = LeaderboardManager;
LeaderboardManager.getInstance = (client) => {
    if (!LeaderboardManager.instance)
        LeaderboardManager.instance = new LeaderboardManager(client);
    return LeaderboardManager.instance;
};
