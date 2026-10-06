"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserBan = exports.clearUserBanCache = void 0;
const user_ban_1 = __importDefault(require("../../events/database/schema/user_ban"));
const CACHE_TTL_MS = 60_000;
const cache = new Map();
const clearUserBanCache = (userId) => {
    cache.delete(userId);
};
exports.clearUserBanCache = clearUserBanCache;
const getUserBan = (client, userId) => {
    if (client.config.bot.owners.includes(userId))
        return Promise.resolve(null);
    const cached = cache.get(userId);
    if (cached)
        return cached;
    const ban = user_ban_1.default
        .findOne({ userId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
        .lean()
        .exec()
        .catch((error) => {
        client.logger.error(`[BAN] Failed to check ban for ${userId}: ${error}`);
        return null;
    });
    cache.set(userId, ban);
    setTimeout(() => cache.delete(userId), CACHE_TTL_MS).unref();
    return ban;
};
exports.getUserBan = getUserBan;
