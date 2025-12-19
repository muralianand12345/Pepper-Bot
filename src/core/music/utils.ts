import discord from 'discord.js';
import magmastream from 'magmastream';

import client from '../../pepper';
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
		if (!client.config.music.feature.progress_bar.enabled) return null;
		const positionMs = Number.isFinite(player?.position) ? Number(player.position) : 0;
		const durationMs = typeof trackDurationMs === 'number' && trackDurationMs > 0 ? trackDurationMs : 0;
		if (!durationMs || durationMs <= 0) return null;

		const computed = this.compute(positionMs, durationMs);
		const bar = this.renderBar(computed.percentage, length);
		return { ...computed, bar };
	}
}

export class VoiceChannelStatus {
	private client: discord.Client;

	constructor(client: discord.Client) {
		this.client = client;
	}

	set = async (voiceChannelId: string, status: string | null): Promise<boolean> => {
		try {
			if (!this.client.config.music.feature.voice_status.enabled) return false;
			if (!voiceChannelId) return false;
			const truncatedStatus = status?.slice(0, 500) ?? null;
			await this.client.rest.put(`/channels/${voiceChannelId}/voice-status`, { body: { status: truncatedStatus } });
			return true;
		} catch (error: any) {
			if (error?.code === 50013) {
				this.client.logger?.warn?.(`[VOICE_STATUS] Missing permissions to set voice status: ${error}`);
			} else {
				this.client.logger?.error?.(`[VOICE_STATUS] Failed to set status: ${error}`);
			}
			return false;
		}
	};

	clear = async (voiceChannelId: string): Promise<boolean> => {
		return this.set(voiceChannelId, null);
	};

	setFromPlayer = async (player: magmastream.Player, customStatus?: string | null): Promise<boolean> => {
		try {
			const voiceChannelId = player.voiceChannelId;
			if (!voiceChannelId) return false;
			if (customStatus !== undefined) return this.set(voiceChannelId, customStatus);
			const currentTrack = await player.queue.getCurrent();
			if (!currentTrack) return this.clear(voiceChannelId);
			const trackInfo = `${currentTrack.title} - ${currentTrack.author}`.slice(0, 80);
			const status = player.playing ? `▶️ ${trackInfo}` : player.paused ? `⏸️ ${trackInfo}` : null;
			return this.set(voiceChannelId, status);
		} catch (error) {
			this.client.logger?.error?.(`[VOICE_STATUS] Failed to set status from player: ${error}`);
			return false;
		}
	};

	setPlaying = async (player: magmastream.Player, track: magmastream.Track): Promise<boolean> => {
		const voiceChannelId = player.voiceChannelId;
		if (!voiceChannelId) return false;
		const trackInfo = `${track.title} - ${track.author}`.slice(0, 80);
		return this.set(voiceChannelId, `▶️ ${trackInfo}`);
	};

	setPaused = async (player: magmastream.Player, track: magmastream.Track): Promise<boolean> => {
		const voiceChannelId = player.voiceChannelId;
		if (!voiceChannelId) return false;
		const trackInfo = `${track.title} - ${track.author}`.slice(0, 80);
		return this.set(voiceChannelId, `⏸️ ${trackInfo}`);
	};

	clearFromPlayer = async (player: magmastream.Player): Promise<boolean> => {
		const voiceChannelId = player.voiceChannelId;
		if (!voiceChannelId) return false;
		return this.clear(voiceChannelId);
	};
}
