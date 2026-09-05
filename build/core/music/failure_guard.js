"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.abandonQueue = exports.failureCount = exports.remainingCooldown = exports.clearFailures = exports.recordFailure = exports.FAILURE_LIMIT = void 0;
const BACKOFF_MS = [5_000, 10_000, 20_000];
exports.FAILURE_LIMIT = BACKOFF_MS.length + 1;
const FAILURE_WINDOW_MS = 5 * 60 * 1000;
const failures = new Map();
const current = (guildId) => {
    const entry = failures.get(guildId);
    if (!entry)
        return null;
    if (Date.now() - entry.lastFailure > FAILURE_WINDOW_MS) {
        failures.delete(guildId);
        return null;
    }
    return entry;
};
const recordFailure = (guildId) => {
    const entry = current(guildId) ?? { count: 0, lastFailure: 0, retryAt: 0 };
    entry.count += 1;
    entry.lastFailure = Date.now();
    const backoffMs = BACKOFF_MS[Math.min(entry.count - 1, BACKOFF_MS.length - 1)];
    entry.retryAt = Date.now() + backoffMs;
    failures.set(guildId, entry);
    return { count: entry.count, tripped: entry.count >= exports.FAILURE_LIMIT, backoffMs };
};
exports.recordFailure = recordFailure;
const clearFailures = (guildId) => {
    failures.delete(guildId);
};
exports.clearFailures = clearFailures;
const remainingCooldown = (guildId) => {
    const entry = current(guildId);
    if (!entry)
        return 0;
    return Math.max(0, entry.retryAt - Date.now());
};
exports.remainingCooldown = remainingCooldown;
const failureCount = (guildId) => current(guildId)?.count ?? 0;
exports.failureCount = failureCount;
const abandonQueue = async (player, client) => {
    try {
        await player.queue.clear();
        await player.queue.setCurrent(null);
    }
    catch (error) {
        client.logger?.warn(`[FAILURE_GUARD] Failed to clear queue for guild ${player.guildId}: ${error}`);
    }
    (0, exports.clearFailures)(player.guildId);
    player.destroy();
};
exports.abandonQueue = abandonQueue;
