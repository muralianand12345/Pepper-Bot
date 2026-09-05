import discord from 'discord.js';
import magmastream from 'magmastream';

const BACKOFF_MS = [5_000, 10_000, 20_000];

export const FAILURE_LIMIT = BACKOFF_MS.length + 1;

const FAILURE_WINDOW_MS = 5 * 60 * 1000;

type GuildFailures = { count: number; lastFailure: number; retryAt: number };

const failures = new Map<string, GuildFailures>();

const current = (guildId: string): GuildFailures | null => {
	const entry = failures.get(guildId);
	if (!entry) return null;
	if (Date.now() - entry.lastFailure > FAILURE_WINDOW_MS) {
		failures.delete(guildId);
		return null;
	}
	return entry;
};

export const recordFailure = (guildId: string): { count: number; tripped: boolean; backoffMs: number } => {
	const entry = current(guildId) ?? { count: 0, lastFailure: 0, retryAt: 0 };
	entry.count += 1;
	entry.lastFailure = Date.now();

	const backoffMs = BACKOFF_MS[Math.min(entry.count - 1, BACKOFF_MS.length - 1)];
	entry.retryAt = Date.now() + backoffMs;
	failures.set(guildId, entry);

	return { count: entry.count, tripped: entry.count >= FAILURE_LIMIT, backoffMs };
};

export const clearFailures = (guildId: string): void => {
	failures.delete(guildId);
};

export const remainingCooldown = (guildId: string): number => {
	const entry = current(guildId);
	if (!entry) return 0;
	return Math.max(0, entry.retryAt - Date.now());
};

export const failureCount = (guildId: string): number => current(guildId)?.count ?? 0;

export const abandonQueue = async (player: magmastream.Player, client: discord.Client): Promise<void> => {
	try {
		await player.queue.clear();
		await player.queue.setCurrent(null);
	} catch (error) {
		client.logger?.warn(`[FAILURE_GUARD] Failed to clear queue for guild ${player.guildId}: ${error}`);
	}
	clearFailures(player.guildId);
	player.destroy();
};
