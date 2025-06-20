"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsManager = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const repo_1 = require("./repo");
const xp_manager_1 = require("./xp_manager");
const format_1 = __importDefault(require("../../../utils/format"));
const leaderboard_1 = require("./leaderboard");
class StatsManager {
    constructor(client) {
        this.getUserStats = async (userId, guildId) => {
            try {
                const userData = await this.userRepo.getUser(userId);
                if (!userData)
                    return null;
                const totalListeningTime = userData.songs.reduce((total, song) => {
                    return total + song.duration * song.played_number;
                }, 0);
                const genreCount = {};
                userData.songs.forEach((song) => {
                    const genre = song.sourceName || 'Unknown';
                    genreCount[genre] = (genreCount[genre] || 0) + song.played_number;
                });
                const favoriteGenre = Object.keys(genreCount).reduce((a, b) => (genreCount[a] > genreCount[b] ? a : b), 'None');
                const ranks = await this.leaderboardManager.getUserRank(userId, guildId);
                return { totalXP: userData.totalXP, currentLevel: userData.currentLevel, dailyXP: userData.dailyXP, weeklyXP: userData.weeklyXP, monthlyXP: userData.monthlyXP, streakDays: userData.streakDays, totalListeningTime: Math.floor(totalListeningTime / 1000), totalSongs: userData.songs.length, favoriteGenre, globalRank: ranks.globalRank, guildRank: ranks.guildRank };
            }
            catch (error) {
                this.client.logger.error(`[STATS] Error getting user stats: ${error}`);
                return null;
            }
        };
        this.createStatsEmbed = async (user, stats, guildId, locale = 'en') => {
            const levelInfo = this.xpManager.getLevelInfo(stats.totalXP);
            const progressBar = this.createProgressBar(levelInfo.progress);
            const embed = new discord_js_1.default.EmbedBuilder().setColor('#5865f2').setTitle(`📊 ${user.displayName}'s Music Stats`).setThumbnail(user.displayAvatarURL()).setTimestamp().setFooter({ text: 'Pepper Music XP System', iconURL: this.client.user?.displayAvatarURL() });
            embed.addFields([
                { name: '🏆 Level & XP', value: `**Level ${stats.currentLevel}**\n` + `${stats.totalXP.toLocaleString()} XP\n` + `${progressBar}\n` + `${levelInfo.xpToNextLevel.toLocaleString()} XP to Level ${levelInfo.currentLevel + 1}`, inline: true },
                { name: '📈 Rankings', value: `Global: **#${stats.globalRank}**\n` + (stats.guildRank ? `Server: **#${stats.guildRank}**` : 'Server: **Not ranked**'), inline: true },
                { name: '⚡ Activity', value: `Daily: **${stats.dailyXP}** XP\n` + `Weekly: **${stats.weeklyXP}** XP\n` + `Monthly: **${stats.monthlyXP}** XP`, inline: true },
            ]);
            const listeningTime = format_1.default.formatListeningTime(stats.totalListeningTime);
            const avgSongLength = stats.totalSongs > 0 ? format_1.default.msToTime((stats.totalListeningTime * 1000) / stats.totalSongs) : '0:00:00';
            embed.addFields([
                { name: '🎵 Music Statistics', value: `**${stats.totalSongs}** songs played\n` + `**${listeningTime}** total listening time\n` + `**${avgSongLength}** average song length\n` + `**${stats.favoriteGenre}** favorite source`, inline: true },
                { name: '🔥 Streak', value: `**${stats.streakDays}** day${stats.streakDays !== 1 ? 's' : ''}\n` + (stats.streakDays >= 7 ? '🎉 Weekly bonus active!' : stats.streakDays >= 1 ? '📈 Daily bonus active!' : '💭 Start your streak!'), inline: true },
            ]);
            const xpRewards = this.xpManager.getXPRewards();
            embed.addFields([{ name: '💎 XP Rewards', value: `Listening: **${xpRewards.LISTEN_PER_MINUTE}** XP/min\n` + `Commands: **${xpRewards.COMMAND_BASIC}-${xpRewards.COMMAND_MUSIC}** XP\n` + `Add to Queue: **${xpRewards.QUEUE_ADD}** XP\n` + `Add Playlist: **${xpRewards.PLAYLIST_ADD}** XP`, inline: false }]);
            return embed;
        };
        this.createProgressBar = (progress) => {
            const totalBars = 10;
            const filledBars = Math.floor((progress / 100) * totalBars);
            const emptyBars = totalBars - filledBars;
            return '▬'.repeat(filledBars) + '▬'.repeat(emptyBars) + ` ${Math.round(progress)}%`;
        };
        this.getDailyStats = async (limit = 10) => {
            try {
                const topDailyUsers = await this.userRepo.getTopDailyUsers(limit);
                const result = [];
                for (let i = 0; i < topDailyUsers.length; i++) {
                    const userData = topDailyUsers[i];
                    try {
                        const user = await this.client.users.fetch(userData.userId).catch(() => null);
                        result.push({ userId: userData.userId, username: user?.username || 'Unknown User', dailyXP: userData.dailyXP, rank: i + 1 });
                    }
                    catch (error) {
                        continue;
                    }
                }
                return result;
            }
            catch (error) {
                this.client.logger.error(`[STATS] Error getting daily stats: ${error}`);
                return [];
            }
        };
        this.getWeeklyStats = async (limit = 10) => {
            try {
                const topWeeklyUsers = await this.userRepo.getTopWeeklyUsers(limit);
                const result = [];
                for (let i = 0; i < topWeeklyUsers.length; i++) {
                    const userData = topWeeklyUsers[i];
                    try {
                        const user = await this.client.users.fetch(userData.userId).catch(() => null);
                        result.push({ userId: userData.userId, username: user?.username || 'Unknown User', weeklyXP: userData.weeklyXP, rank: i + 1 });
                    }
                    catch (error) {
                        continue;
                    }
                }
                return result;
            }
            catch (error) {
                this.client.logger.error(`[STATS] Error getting weekly stats: ${error}`);
                return [];
            }
        };
        this.resetDailyStats = async () => {
            try {
                await this.userRepo.resetDailyXP();
                this.client.logger.info('[STATS] Daily XP stats reset completed');
            }
            catch (error) {
                this.client.logger.error(`[STATS] Error resetting daily stats: ${error}`);
            }
        };
        this.resetWeeklyStats = async () => {
            try {
                await this.userRepo.resetWeeklyXP();
                this.client.logger.info('[STATS] Weekly XP stats reset completed');
            }
            catch (error) {
                this.client.logger.error(`[STATS] Error resetting weekly stats: ${error}`);
            }
        };
        this.resetMonthlyStats = async () => {
            try {
                await this.userRepo.resetMonthlyXP();
                this.client.logger.info('[STATS] Monthly XP stats reset completed');
            }
            catch (error) {
                this.client.logger.error(`[STATS] Error resetting monthly stats: ${error}`);
            }
        };
        this.client = client;
        this.userRepo = new repo_1.XPUserRepo();
        this.xpManager = xp_manager_1.XPManager.getInstance(client);
        this.leaderboardManager = leaderboard_1.LeaderboardManager.getInstance(client);
    }
}
exports.StatsManager = StatsManager;
StatsManager.getInstance = (client) => {
    if (!StatsManager.instance)
        StatsManager.instance = new StatsManager(client);
    return StatsManager.instance;
};
