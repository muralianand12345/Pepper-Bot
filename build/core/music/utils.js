"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressBarUtils = void 0;
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
