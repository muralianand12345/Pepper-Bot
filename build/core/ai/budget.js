"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.takeAIBudget = void 0;
const config_1 = require("./config");
const config_2 = require("../../utils/config");
const configManager = config_2.ConfigManager.getInstance();
const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;
let localDay = '';
const localCounts = new Map();
const today = () => new Date().toISOString().slice(0, 10);
const increment = async (client, keys) => {
    const redis = client.manager?.redis;
    if (redis) {
        const pipeline = redis.multi();
        for (const key of keys)
            pipeline.incr(key).expire(key, KEY_TTL_SECONDS);
        const results = await pipeline.exec();
        return keys.map((_, index) => Number(results?.[index * 2]?.[1] ?? Infinity));
    }
    const day = today();
    if (day !== localDay) {
        localCounts.clear();
        localDay = day;
    }
    return keys.map((key) => {
        const next = (localCounts.get(key) ?? 0) + 1;
        localCounts.set(key, next);
        return next;
    });
};
const takeAIBudget = async (client, feature, guildId, perGuildLimit) => {
    const prefix = configManager.getRedisConfig()?.prefix ?? 'pepper:';
    const day = today();
    try {
        const [guildCount, totalCount] = await increment(client, [`${prefix}ai:${feature}:${day}:${guildId}`, `${prefix}ai:all:${day}`]);
        return guildCount <= perGuildLimit && totalCount <= (0, config_1.getAIConfig)(client).daily_limit;
    }
    catch (error) {
        client.logger.warn(`[AI] Couldn't check the daily budget, skipping AI: ${error}`);
        return false;
    }
};
exports.takeAIBudget = takeAIBudget;
