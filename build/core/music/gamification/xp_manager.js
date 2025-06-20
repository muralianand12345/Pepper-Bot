"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XPManager = void 0;
const repo_1 = require("./repo");
class XPManager {
    constructor(client) {
        this.XP_REWARDS = {
            LISTEN_PER_MINUTE: 2,
            COMMAND_BASIC: 5,
            COMMAND_MUSIC: 10,
            QUEUE_ADD: 15,
            PLAYLIST_ADD: 25,
            SHARE_SONG: 20,
            DAILY_STREAK_BONUS: 1.2,
            WEEKLY_STREAK_BONUS: 1.5,
            FIRST_TIME_BONUS: 50,
        };
        this.COOLDOWNS = {
            COMMAND_XP: 30000, // 30 seconds
            LISTEN_XP: 60000, // 1 minute
        };
        this.userCooldowns = new Map();
        this.calculateLevel = (totalXP) => {
            if (totalXP < 0)
                return 1;
            let level = 1;
            let xpRequired = this.getXPRequiredForLevel(level);
            while (totalXP >= xpRequired) {
                level++;
                xpRequired = this.getXPRequiredForLevel(level);
            }
            return level - 1;
        };
        this.getXPRequiredForLevel = (level) => {
            if (level <= 1)
                return 0;
            return (level - 1) ** 2 * 100 + (level - 1) * 50;
        };
        this.getTotalXPForLevel = (level) => {
            let totalXP = 0;
            for (let i = 2; i <= level; i++) {
                totalXP += this.getXPRequiredForLevel(i);
            }
            return totalXP;
        };
        this.getLevelInfo = (totalXP) => {
            const currentLevel = this.calculateLevel(totalXP);
            const xpForCurrentLevel = this.getTotalXPForLevel(currentLevel);
            const xpForNextLevel = this.getTotalXPForLevel(currentLevel + 1);
            const xpToNextLevel = xpForNextLevel - totalXP;
            const progress = ((totalXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;
            return { currentLevel, currentXP: totalXP, xpForCurrentLevel, xpForNextLevel, xpToNextLevel, progress: Math.max(0, Math.min(100, progress)) };
        };
        this.isOnCooldown = (userId, actionType) => {
            const userCooldowns = this.userCooldowns.get(userId);
            if (!userCooldowns)
                return false;
            const lastAction = userCooldowns.get(actionType);
            if (!lastAction)
                return false;
            const cooldownTime = this.COOLDOWNS[actionType] || 0;
            return Date.now() - lastAction < cooldownTime;
        };
        this.setCooldown = (userId, actionType) => {
            if (!this.userCooldowns.has(userId))
                this.userCooldowns.set(userId, new Map());
            this.userCooldowns.get(userId).set(actionType, Date.now());
        };
        this.awardXP = async (userId, guildId, action) => {
            try {
                const cooldownKey = `${action.type}_XP`;
                if (this.isOnCooldown(userId, cooldownKey))
                    return { xpGained: 0, levelUp: false };
                const userData = await this.userRepo.getOrCreateUser(userId);
                const oldLevel = userData.currentLevel;
                let baseXP = this.getBaseXPForAction(action.type);
                const multiplier = await this.calculateMultiplier(userData);
                const finalXP = Math.floor(baseXP * multiplier);
                const updatedUser = await this.userRepo.addXP(userId, finalXP);
                const newLevel = this.calculateLevel(updatedUser.totalXP);
                if (newLevel !== oldLevel)
                    await this.userRepo.updateLevel(userId, newLevel);
                if (guildId)
                    await this.guildRepo.addGuildXP(guildId, finalXP);
                this.setCooldown(userId, cooldownKey);
                this.client.logger.debug(`[XP] User ${userId} gained ${finalXP} XP for ${action.type}`);
                return { xpGained: finalXP, levelUp: newLevel > oldLevel, newLevel: newLevel > oldLevel ? newLevel : undefined };
            }
            catch (error) {
                this.client.logger.error(`[XP] Error awarding XP: ${error}`);
                return { xpGained: 0, levelUp: false };
            }
        };
        this.getBaseXPForAction = (actionType) => {
            switch (actionType) {
                case 'listen':
                    return this.XP_REWARDS.LISTEN_PER_MINUTE;
                case 'command':
                    return this.XP_REWARDS.COMMAND_BASIC;
                case 'command_music':
                    return this.XP_REWARDS.COMMAND_MUSIC;
                case 'queue_add':
                    return this.XP_REWARDS.QUEUE_ADD;
                case 'playlist_add':
                    return this.XP_REWARDS.PLAYLIST_ADD;
                case 'share':
                    return this.XP_REWARDS.SHARE_SONG;
                default:
                    return 1;
            }
        };
        this.calculateMultiplier = async (userData) => {
            let multiplier = userData.xpMultiplier || 1.0;
            const daysSinceLastActive = Math.floor((Date.now() - new Date(userData.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceLastActive === 1)
                multiplier *= this.XP_REWARDS.DAILY_STREAK_BONUS;
            if (userData.streakDays >= 7)
                multiplier *= this.XP_REWARDS.WEEKLY_STREAK_BONUS;
            return Math.min(multiplier, 3.0);
        };
        this.startListeningSession = async (userId) => {
            try {
                await this.userRepo.setListeningStart(userId, new Date());
            }
            catch (error) {
                this.client.logger.error(`[XP] Error starting listening session: ${error}`);
            }
        };
        this.endListeningSession = async (userId, guildId) => {
            try {
                const userData = await this.userRepo.getUser(userId);
                if (!userData || !userData.listeningStartTime)
                    return { xpGained: 0, minutesListened: 0 };
                const sessionEnd = new Date();
                const sessionStart = new Date(userData.listeningStartTime);
                const minutesListened = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60));
                if (minutesListened >= 1) {
                    const xpResult = await this.awardXP(userId, guildId, { type: 'listen', xpGained: minutesListened * this.XP_REWARDS.LISTEN_PER_MINUTE, timestamp: new Date(), details: `${minutesListened} minutes` });
                    await this.userRepo.clearListeningStart(userId);
                    return { xpGained: xpResult.xpGained, minutesListened };
                }
                return { xpGained: 0, minutesListened };
            }
            catch (error) {
                this.client.logger.error(`[XP] Error ending listening session: ${error}`);
                return { xpGained: 0, minutesListened: 0 };
            }
        };
        this.getXPRewards = () => this.XP_REWARDS;
        this.client = client;
        this.userRepo = new repo_1.XPUserRepo();
        this.guildRepo = new repo_1.XPGuildRepo();
    }
}
exports.XPManager = XPManager;
XPManager.getInstance = (client) => {
    if (!XPManager.instance)
        XPManager.instance = new XPManager(client);
    return XPManager.instance;
};
