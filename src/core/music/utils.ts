import magmastream from 'magmastream';

import Formatter from '../../utils/format';
import { ProgressComputation } from '../../types';

export class ProgressBarUtils {
	static renderBar(percentage: number, length: number = 15): string {
		const pct = Math.max(0, Math.min(1, percentage));
		const filled = Math.floor(pct * length);
		const left = Math.max(0, filled);
		const right = Math.max(0, length - left - 1);
		const bar = '▬'.repeat(left) + '●' + '▬'.repeat(right);
		return `**${bar}**`;
	}

	static compute(positionMs: number, durationMs: number): Omit<ProgressComputation, 'bar'> {
		const safeDuration = Math.max(0, durationMs);
		const normalized = Math.min(Math.max(0, positionMs), Math.max(1, safeDuration));
		if (safeDuration <= 0) return { displayPosition: normalized, percentage: 0, formattedPosition: Formatter.msToTime(normalized), formattedDuration: '00:00:00' };

		const pctWindow = Math.floor(safeDuration * 0.02); // 2% of duration
		const dynamicWindow = Math.min(6000, Math.max(2000, pctWindow));
		const remaining = Math.max(0, safeDuration - normalized);
		const displayPositionMs = remaining <= dynamicWindow ? safeDuration : normalized;
		const percentage = displayPositionMs / safeDuration;
		return { displayPosition: displayPositionMs, percentage, formattedPosition: Formatter.msToTime(displayPositionMs), formattedDuration: Formatter.msToTime(safeDuration) };
	}

	static createBarFromPlayer(player: magmastream.Player, trackDurationMs?: number, length: number = 15): ProgressComputation | null {
		const positionMs = Number.isFinite(player?.position) ? Number(player.position) : 0;
		const durationMs = typeof trackDurationMs === 'number' && trackDurationMs > 0 ? trackDurationMs : 0;
		if (!durationMs || durationMs <= 0) return null;

		const computed = this.compute(positionMs, durationMs);
		const bar = this.renderBar(computed.percentage, length);
		return { ...computed, bar };
	}
}
