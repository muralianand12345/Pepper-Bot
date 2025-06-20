"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XPUserRepo = void 0;
const music_user_1 = __importDefault(require("../../../../events/database/schema/music_user"));
class XPUserRepo {
    constructor() {
        this.getUser = async (userId) => {
            try {
                return await music_user_1.default.findOne({ userId }).lean();
            }
            catch (error) {
                throw new Error(`Failed to get user: ${error}`);
            }
        };
        this.getOrCreateUser = async (userId) => {
            try {
                let user = await music_user_1.default.findOne({ userId });
                if (!user) {
                    user = new music_user_1.default({
                        userId,
                        totalXP: 0,
                        currentLevel: 1,
                        lastXPGain: new Date(),
                        dailyXP: 0,
                        weeklyXP: 0,
                        monthlyXP: 0,
                        lastDailyReset: new Date(),
                        lastWeeklyReset: new Date(),
                        lastMonthlyReset: new Date(),
                        xpMultiplier: 1.0,
                        streakDays: 0,
                        lastActiveDate: new Date(),
                        songs: [],
                    });
                    await user.save();
                }
                return user;
            }
            catch (error) {
                throw new Error(`Failed to get or create user: ${error}`);
            }
        };
        this.addXP = async (userId, xpAmount) => {
            try {
                const now = new Date();
                const user = await this.getOrCreateUser(userId);
                const updates = { $inc: { totalXP: xpAmount, dailyXP: xpAmount, weeklyXP: xpAmount, monthlyXP: xpAmount }, $set: { lastXPGain: now, lastActiveDate: now } };
                const daysSinceDaily = Math.floor((now.getTime() - new Date(user.lastDailyReset).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceDaily >= 1) {
                    updates.$set.dailyXP = xpAmount;
                    updates.$set.lastDailyReset = now;
                    if (daysSinceDaily === 1) {
                        updates.$inc.streakDays = 1;
                    }
                    else {
                        updates.$set.streakDays = 1;
                    }
                }
                const daysSinceWeekly = Math.floor((now.getTime() - new Date(user.lastWeeklyReset).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceWeekly >= 7) {
                    updates.$set.weeklyXP = xpAmount;
                    updates.$set.lastWeeklyReset = now;
                }
                const daysSinceMonthly = Math.floor((now.getTime() - new Date(user.lastMonthlyReset).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceMonthly >= 30) {
                    updates.$set.monthlyXP = xpAmount;
                    updates.$set.lastMonthlyReset = now;
                }
                const updatedUser = await music_user_1.default.findOneAndUpdate({ userId }, updates, { new: true, upsert: true });
                if (!updatedUser)
                    throw new Error('Failed to update user XP');
                return updatedUser;
            }
            catch (error) {
                throw new Error(`Failed to add XP: ${error}`);
            }
        };
        this.updateLevel = async (userId, newLevel) => {
            try {
                await music_user_1.default.updateOne({ userId }, { $set: { currentLevel: newLevel } });
            }
            catch (error) {
                throw new Error(`Failed to update level: ${error}`);
            }
        };
        this.setListeningStart = async (userId, startTime) => {
            try {
                await music_user_1.default.updateOne({ userId }, { $set: { listeningStartTime: startTime } });
            }
            catch (error) {
                throw new Error(`Failed to set listening start: ${error}`);
            }
        };
        this.clearListeningStart = async (userId) => {
            try {
                await music_user_1.default.updateOne({ userId }, { $unset: { listeningStartTime: 1 } });
            }
            catch (error) {
                throw new Error(`Failed to clear listening start: ${error}`);
            }
        };
        this.getTopUsers = async (limit = 10) => {
            try {
                return await music_user_1.default.find({}).sort({ totalXP: -1 }).limit(limit).lean();
            }
            catch (error) {
                throw new Error(`Failed to get top users: ${error}`);
            }
        };
        this.getUserGlobalRank = async (userId) => {
            try {
                const user = await music_user_1.default.findOne({ userId });
                if (!user)
                    return 0;
                const rank = await music_user_1.default.countDocuments({ totalXP: { $gt: user.totalXP } });
                return rank + 1;
            }
            catch (error) {
                throw new Error(`Failed to get user global rank: ${error}`);
            }
        };
        this.getTopDailyUsers = async (limit = 10) => {
            try {
                return await music_user_1.default
                    .find({ dailyXP: { $gt: 0 } })
                    .sort({ dailyXP: -1 })
                    .limit(limit)
                    .lean();
            }
            catch (error) {
                throw new Error(`Failed to get top daily users: ${error}`);
            }
        };
        this.getTopWeeklyUsers = async (limit = 10) => {
            try {
                return await music_user_1.default
                    .find({ weeklyXP: { $gt: 0 } })
                    .sort({ weeklyXP: -1 })
                    .limit(limit)
                    .lean();
            }
            catch (error) {
                throw new Error(`Failed to get top weekly users: ${error}`);
            }
        };
        this.resetDailyXP = async () => {
            try {
                await music_user_1.default.updateMany({}, { $set: { dailyXP: 0, lastDailyReset: new Date() } });
            }
            catch (error) {
                throw new Error(`Failed to reset daily XP: ${error}`);
            }
        };
        this.resetWeeklyXP = async () => {
            try {
                await music_user_1.default.updateMany({}, { $set: { weeklyXP: 0, lastWeeklyReset: new Date() } });
            }
            catch (error) {
                throw new Error(`Failed to reset weekly XP: ${error}`);
            }
        };
        this.resetMonthlyXP = async () => {
            try {
                await music_user_1.default.updateMany({}, { $set: { monthlyXP: 0, lastMonthlyReset: new Date() } });
            }
            catch (error) {
                throw new Error(`Failed to reset monthly XP: ${error}`);
            }
        };
        this.updateStreak = async (userId, streakDays) => {
            try {
                await music_user_1.default.updateOne({ userId }, { $set: { streakDays } });
            }
            catch (error) {
                throw new Error(`Failed to update streak: ${error}`);
            }
        };
        this.setMultiplier = async (userId, multiplier) => {
            try {
                await music_user_1.default.updateOne({ userId }, { $set: { xpMultiplier: multiplier } });
            }
            catch (error) {
                throw new Error(`Failed to set multiplier: ${error}`);
            }
        };
    }
}
exports.XPUserRepo = XPUserRepo;
