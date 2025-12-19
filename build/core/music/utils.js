"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceChannelStatus = exports.ProgressBarUtils = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const pepper_1 = __importDefault(require("../../pepper"));
const format_1 = __importDefault(require("../../utils/format"));
class ProgressBarUtils {
    static renderBar(percentage, length = 15) {
        const pct = Math.max(0, Math.min(1, percentage));
        const filled = Math.floor(pct * length);
        const left = Math.max(0, filled);
        const right = Math.max(0, length - left - 1);
        const bar = '▬'.repeat(left) + '●' + '▬'.repeat(right);
        return `**${bar}**`;
    }
    static compute(positionMs, durationMs) {
        const safeDuration = Math.max(0, durationMs);
        const normalized = Math.min(Math.max(0, positionMs), Math.max(1, safeDuration));
        if (safeDuration <= 0)
            return { displayPosition: normalized, percentage: 0, formattedPosition: format_1.default.msToTime(normalized), formattedDuration: '00:00:00' };
        const pctWindow = Math.floor(safeDuration * 0.02); // 2% of duration
        const dynamicWindow = Math.min(6000, Math.max(2000, pctWindow));
        const remaining = Math.max(0, safeDuration - normalized);
        const displayPositionMs = remaining <= dynamicWindow ? safeDuration : normalized;
        const percentage = displayPositionMs / safeDuration;
        return { displayPosition: displayPositionMs, percentage, formattedPosition: format_1.default.msToTime(displayPositionMs), formattedDuration: format_1.default.msToTime(safeDuration) };
    }
    static createBarFromPlayer(player, trackDurationMs, length = 15) {
        if (!pepper_1.default.config.music.feature.progress_bar.enabled)
            return null;
        const positionMs = Number.isFinite(player?.position) ? Number(player.position) : 0;
        const durationMs = typeof trackDurationMs === 'number' && trackDurationMs > 0 ? trackDurationMs : 0;
        if (!durationMs || durationMs <= 0)
            return null;
        const computed = this.compute(positionMs, durationMs);
        const bar = this.renderBar(computed.percentage, length);
        return { ...computed, bar };
    }
}
exports.ProgressBarUtils = ProgressBarUtils;
class VoiceChannelStatus {
    constructor(client) {
        this.queue = new Map();
        this.lastUpdateTime = new Map();
        this.processing = false;
        this.rateLimitedUntil = 0;
        this.MIN_INTERVAL = 5000;
        this.RATE_LIMIT_BACKOFF = 30000;
        this.DEBOUNCE_DELAY = 1000;
        this.debounceTimers = new Map();
        this.set = async (voiceChannelId, status) => {
            if (!this.client.config.music.feature.voice_status.enabled)
                return false;
            if (!voiceChannelId)
                return false;
            return new Promise((resolve) => {
                const existingTimer = this.debounceTimers.get(voiceChannelId);
                if (existingTimer)
                    clearTimeout(existingTimer);
                const timer = setTimeout(() => {
                    this.debounceTimers.delete(voiceChannelId);
                    this.enqueue(voiceChannelId, status, resolve);
                }, this.DEBOUNCE_DELAY);
                this.debounceTimers.set(voiceChannelId, timer);
            });
        };
        this.enqueue = (voiceChannelId, status, resolve) => {
            const truncatedStatus = status?.slice(0, 500) ?? null;
            const existingUpdate = this.queue.get(voiceChannelId);
            if (existingUpdate)
                existingUpdate.resolve(false);
            this.queue.set(voiceChannelId, { voiceChannelId, status: truncatedStatus, resolve, timestamp: Date.now() });
            this.processQueue();
        };
        this.processQueue = async () => {
            if (this.processing || this.queue.size === 0)
                return;
            if (Date.now() < this.rateLimitedUntil) {
                const delay = this.rateLimitedUntil - Date.now();
                setTimeout(() => this.processQueue(), delay);
                return;
            }
            this.processing = true;
            try {
                const entries = Array.from(this.queue.entries());
                for (const [channelId, update] of entries) {
                    const lastUpdate = this.lastUpdateTime.get(channelId) || 0;
                    const timeSinceLastUpdate = Date.now() - lastUpdate;
                    if (timeSinceLastUpdate < this.MIN_INTERVAL) {
                        const delay = this.MIN_INTERVAL - timeSinceLastUpdate;
                        await this.sleep(delay);
                    }
                    if (Date.now() < this.rateLimitedUntil) {
                        this.processing = false;
                        this.processQueue();
                        return;
                    }
                    this.queue.delete(channelId);
                    const success = await this.executeUpdate(update);
                    update.resolve(success);
                    if (success)
                        this.lastUpdateTime.set(channelId, Date.now());
                }
            }
            finally {
                this.processing = false;
                if (this.queue.size > 0)
                    this.processQueue();
            }
        };
        this.executeUpdate = async (update) => {
            try {
                await this.client.rest.put(`/channels/${update.voiceChannelId}/voice-status`, { body: { status: update.status } });
                return true;
            }
            catch (error) {
                return this.handleError(error, update.voiceChannelId);
            }
        };
        this.handleError = (error, channelId) => {
            if (!(error instanceof discord_js_1.default.DiscordAPIError)) {
                this.client.logger?.error?.(`[VOICE_STATUS] Failed to set status: ${error}`);
                return false;
            }
            if (error.code === 50013) {
                this.client.logger?.warn?.(`[VOICE_STATUS] Missing permissions for channel ${channelId}`);
                return false;
            }
            if (error.status === 429 || error.code === 429) {
                const rawError = error.rawError;
                const retryAfter = rawError?.retry_after ?? 30;
                this.rateLimitedUntil = Date.now() + retryAfter * 1000;
                this.client.logger?.warn?.(`[VOICE_STATUS] Rate limited, backing off for ${retryAfter}s`);
                return false;
            }
            if (error.code === 10003) {
                this.client.logger?.warn?.(`[VOICE_STATUS] Channel ${channelId} not found`);
                this.lastUpdateTime.delete(channelId);
                return false;
            }
            if (error.code === 50001) {
                this.client.logger?.warn?.(`[VOICE_STATUS] Missing access to channel ${channelId}`);
                return false;
            }
            this.client.logger?.error?.(`[VOICE_STATUS] Failed to set status: ${error.message}`);
            return false;
        };
        this.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        this.clear = async (voiceChannelId) => {
            return this.set(voiceChannelId, null);
        };
        this.setFromPlayer = async (player, customStatus) => {
            try {
                const voiceChannelId = player.voiceChannelId;
                if (!voiceChannelId)
                    return false;
                if (customStatus !== undefined)
                    return this.set(voiceChannelId, customStatus);
                const currentTrack = await player.queue.getCurrent();
                if (!currentTrack)
                    return this.clear(voiceChannelId);
                const trackInfo = `${currentTrack.title} - ${currentTrack.author}`.slice(0, 80);
                const status = player.playing ? `▶️ ${trackInfo}` : player.paused ? `⏸️ ${trackInfo}` : null;
                return this.set(voiceChannelId, status);
            }
            catch (error) {
                this.client.logger?.error?.(`[VOICE_STATUS] Failed to set status from player: ${error}`);
                return false;
            }
        };
        this.setPlaying = async (player, track) => {
            const voiceChannelId = player.voiceChannelId;
            if (!voiceChannelId)
                return false;
            const trackInfo = `${track.title} - ${track.author}`.slice(0, 80);
            return this.set(voiceChannelId, `▶️ ${trackInfo}`);
        };
        this.setPaused = async (player, track) => {
            const voiceChannelId = player.voiceChannelId;
            if (!voiceChannelId)
                return false;
            const trackInfo = `${track.title} - ${track.author}`.slice(0, 80);
            return this.set(voiceChannelId, `⏸️ ${trackInfo}`);
        };
        this.clearFromPlayer = async (player) => {
            const voiceChannelId = player.voiceChannelId;
            if (!voiceChannelId)
                return false;
            return this.clear(voiceChannelId);
        };
        this.clearPendingUpdates = (voiceChannelId) => {
            if (voiceChannelId) {
                const timer = this.debounceTimers.get(voiceChannelId);
                if (timer)
                    clearTimeout(timer);
                this.debounceTimers.delete(voiceChannelId);
                const pending = this.queue.get(voiceChannelId);
                if (pending) {
                    pending.resolve(false);
                    this.queue.delete(voiceChannelId);
                }
            }
            else {
                this.debounceTimers.forEach((timer) => clearTimeout(timer));
                this.debounceTimers.clear();
                this.queue.forEach((update) => update.resolve(false));
                this.queue.clear();
            }
        };
        this.client = client;
    }
}
exports.VoiceChannelStatus = VoiceChannelStatus;
