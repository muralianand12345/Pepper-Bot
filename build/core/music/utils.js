"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceChannelStatus = exports.ProgressBarUtils = void 0;
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
        this.set = async (voiceChannelId, status) => {
            try {
                if (!voiceChannelId)
                    return false;
                const truncatedStatus = status?.slice(0, 500) ?? null;
                await this.client.rest.put(`/channels/${voiceChannelId}/voice-status`, { body: { status: truncatedStatus } });
                return true;
            }
            catch (error) {
                if (error?.code === 50013) {
                    this.client.logger?.warn?.(`[VOICE_STATUS] Missing permissions to set voice status: ${error}`);
                }
                else {
                    this.client.logger?.error?.(`[VOICE_STATUS] Failed to set status: ${error}`);
                }
                return false;
            }
        };
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
        this.client = client;
    }
}
exports.VoiceChannelStatus = VoiceChannelStatus;
