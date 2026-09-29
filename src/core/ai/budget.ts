import discord from 'discord.js';

import { getAIConfig } from './config';
import { ConfigManager } from '../../utils/config';

const configManager = ConfigManager.getInstance();

const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

let localDay = '';
const localCounts = new Map<string, number>();

const today = (): string => new Date().toISOString().slice(0, 10);

const increment = async (client: discord.Client, keys: string[]): Promise<number[]> => {
	const redis = client.manager?.redis;
	if (redis) {
		const pipeline = redis.multi();
		for (const key of keys) pipeline.incr(key).expire(key, KEY_TTL_SECONDS);
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

export const takeAIBudget = async (client: discord.Client, feature: string, guildId: string, perGuildLimit: number): Promise<boolean> => {
	const prefix = configManager.getRedisConfig()?.prefix ?? 'pepper:';
	const day = today();
	try {
		const [guildCount, totalCount] = await increment(client, [`${prefix}ai:${feature}:${day}:${guildId}`, `${prefix}ai:all:${day}`]);
		return guildCount <= perGuildLimit && totalCount <= getAIConfig(client).daily_limit;
	} catch (error) {
		client.logger.warn(`[AI] Couldn't check the daily budget, skipping AI: ${error}`);
		return false;
	}
};
