import discord from 'discord.js';

import { IUserBan } from '../../types';
import user_ban from '../../events/database/schema/user_ban';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, Promise<IUserBan | null>>();

export const clearUserBanCache = (userId: string): void => {
	cache.delete(userId);
};

export const getUserBan = (client: discord.Client, userId: string): Promise<IUserBan | null> => {
	if (client.config.bot.owners.includes(userId)) return Promise.resolve(null);

	const cached = cache.get(userId);
	if (cached) return cached;

	const ban = user_ban
		.findOne({ userId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
		.lean<IUserBan>()
		.exec()
		.catch((error) => {
			client.logger.error(`[BAN] Failed to check ban for ${userId}: ${error}`);
			return null;
		});

	cache.set(userId, ban);
	setTimeout(() => cache.delete(userId), CACHE_TTL_MS).unref();
	return ban;
};
