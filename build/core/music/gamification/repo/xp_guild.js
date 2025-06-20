"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XPGuildRepo = void 0;
const music_guild_1 = __importDefault(require("../../../../events/database/schema/music_guild"));
class XPGuildRepo {
    constructor() {
        this.getGuild = async (guildId) => {
            try {
                return await music_guild_1.default.findOne({ guildId }).lean();
            }
            catch (error) {
                throw new Error(`Failed to get guild: ${error}`);
            }
        };
        this.getOrCreateGuild = async (guildId) => {
            try {
                let guild = await music_guild_1.default.findOne({ guildId });
                if (!guild) {
                    guild = new music_guild_1.default({
                        guildId,
                        totalGuildXP: 0,
                        activeMembers: 0,
                        lastActivity: new Date(),
                        songs: [],
                    });
                    await guild.save();
                }
                return guild;
            }
            catch (error) {
                throw new Error(`Failed to get or create guild: ${error}`);
            }
        };
        this.addGuildXP = async (guildId, xpAmount) => {
            try {
                await music_guild_1.default.updateOne({ guildId }, { $inc: { totalGuildXP: xpAmount }, $set: { lastActivity: new Date() } }, { upsert: true });
            }
            catch (error) {
                throw new Error(`Failed to add guild XP: ${error}`);
            }
        };
        this.updateActiveMembers = async (guildId, memberCount) => {
            try {
                await music_guild_1.default.updateOne({ guildId }, { $set: { activeMembers: memberCount } }, { upsert: true });
            }
            catch (error) {
                throw new Error(`Failed to update active members: ${error}`);
            }
        };
        this.getTopGuilds = async (limit = 10) => {
            try {
                return await music_guild_1.default.find({}).sort({ totalGuildXP: -1 }).limit(limit).lean();
            }
            catch (error) {
                throw new Error(`Failed to get top guilds: ${error}`);
            }
        };
        this.getGuildRank = async (guildId) => {
            try {
                const guild = await music_guild_1.default.findOne({ guildId });
                if (!guild)
                    return 0;
                const rank = await music_guild_1.default.countDocuments({ totalGuildXP: { $gt: guild.totalGuildXP } });
                return rank + 1;
            }
            catch (error) {
                throw new Error(`Failed to get guild rank: ${error}`);
            }
        };
    }
}
exports.XPGuildRepo = XPGuildRepo;
