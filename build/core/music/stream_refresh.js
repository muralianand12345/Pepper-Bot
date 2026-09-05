"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshStream = exports.consumeStreamRefresh = exports.canRetryStuck = exports.isStreamStale = exports.clearPaused = exports.markPaused = void 0;
const STALE_AFTER_MS = 2 * 60 * 1000;
const STUCK_RETRY_WINDOW_MS = 60 * 1000;
const SEEK_HEADROOM_MS = 500;
const pausedSince = new Map();
const refreshing = new Map();
const stuckRetries = new Map();
const markPaused = (guildId) => {
    pausedSince.set(guildId, Date.now());
};
exports.markPaused = markPaused;
const clearPaused = (guildId) => {
    pausedSince.delete(guildId);
};
exports.clearPaused = clearPaused;
const isStreamStale = (guildId) => {
    const since = pausedSince.get(guildId);
    return since !== undefined && Date.now() - since > STALE_AFTER_MS;
};
exports.isStreamStale = isStreamStale;
const canRetryStuck = (guildId, track) => {
    const identifier = track.identifier || track.track;
    const last = stuckRetries.get(guildId);
    if (last && last.identifier === identifier && Date.now() - last.at < STUCK_RETRY_WINDOW_MS)
        return false;
    stuckRetries.set(guildId, { identifier, at: Date.now() });
    return true;
};
exports.canRetryStuck = canRetryStuck;
const consumeStreamRefresh = (guildId, track) => {
    const marker = refreshing.get(guildId);
    if (!marker)
        return false;
    refreshing.delete(guildId);
    return !!track && marker === (track.identifier || track.track);
};
exports.consumeStreamRefresh = consumeStreamRefresh;
const refreshStream = async (player, client, reason) => {
    const current = await player.queue?.getCurrent();
    if (!current)
        return false;
    if (current.isStream)
        return false;
    const duration = Number(current.duration || 0);
    const rawPosition = Number(player.position || 0);
    const position = duration > 0 ? Math.min(Math.max(0, rawPosition), Math.max(0, duration - SEEK_HEADROOM_MS)) : Math.max(0, rawPosition);
    try {
        refreshing.set(player.guildId, current.identifier || current.track);
        if (player.paused)
            await player.pause(false); // a replaced track inherits the paused state
        await player.play(current, { startTime: position });
        client.logger?.info(`[STREAM_REFRESH] Re-resolved ${current.title} at ${position}ms for guild ${player.guildId} (${reason})`);
        return true;
    }
    catch (error) {
        refreshing.delete(player.guildId);
        client.logger?.warn(`[STREAM_REFRESH] Failed to refresh stream for guild ${player.guildId}: ${error}`);
        return false;
    }
};
exports.refreshStream = refreshStream;
