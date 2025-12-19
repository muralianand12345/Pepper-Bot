import discord from 'discord.js';
import magmastream from 'magmastream';

import client from '../../pepper';
import Formatter from '../../utils/format';
import { ProgressComputation, StatusUpdate } from '../../types';

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
	private queue: Map<string, StatusUpdate> = new Map();
	private lastUpdateTime: Map<string, number> = new Map();
	private processing: boolean = false;
	private rateLimitedUntil: number = 0;
	private readonly MIN_INTERVAL = 5000;
	private readonly RATE_LIMIT_BACKOFF = 30000;
	private readonly DEBOUNCE_DELAY = 1000;
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

	constructor(client: discord.Client) {
		this.client = client;
	}

	set = async (voiceChannelId: string, status: string | null): Promise<boolean> => {
		if (!this.client.config.music.feature.voice_status.enabled) return false;
		if (!voiceChannelId) return false;

		return new Promise((resolve) => {
			const existingTimer = this.debounceTimers.get(voiceChannelId);
			if (existingTimer) clearTimeout(existingTimer);

			const timer = setTimeout(() => {
				this.debounceTimers.delete(voiceChannelId);
				this.enqueue(voiceChannelId, status, resolve);
			}, this.DEBOUNCE_DELAY);
			this.debounceTimers.set(voiceChannelId, timer);
		});
	};

	private enqueue = (voiceChannelId: string, status: string | null, resolve: (value: boolean) => void): void => {
		const truncatedStatus = status?.slice(0, 500) ?? null;
		const existingUpdate = this.queue.get(voiceChannelId);
		if (existingUpdate) existingUpdate.resolve(false);

		this.queue.set(voiceChannelId, { voiceChannelId, status: truncatedStatus, resolve, timestamp: Date.now() });
		this.processQueue();
	};

	private processQueue = async (): Promise<void> => {
		if (this.processing || this.queue.size === 0) return;
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

				if (success) this.lastUpdateTime.set(channelId, Date.now());
			}
		} finally {
			this.processing = false;
			if (this.queue.size > 0) this.processQueue();
		}
	};

	private executeUpdate = async (update: StatusUpdate): Promise<boolean> => {
		try {
			await this.client.rest.put(`/channels/${update.voiceChannelId}/voice-status`, { body: { status: update.status } });
			return true;
		} catch (error) {
			return this.handleError(error, update.voiceChannelId);
		}
	};

	private handleError = (error: unknown, channelId: string): boolean => {
		if (!(error instanceof discord.DiscordAPIError)) {
			this.client.logger?.error?.(`[VOICE_STATUS] Failed to set status: ${error}`);
			return false;
		}

		if (error.code === 50013) {
			this.client.logger?.warn?.(`[VOICE_STATUS] Missing permissions for channel ${channelId}`);
			return false;
		}

		if (error.status === 429 || error.code === 429) {
			const rawError = error.rawError as { retry_after?: number };
			const backoffMs = typeof rawError?.retry_after === 'number' && rawError.retry_after > 0 ? rawError.retry_after * 1000 : this.RATE_LIMIT_BACKOFF;
			this.rateLimitedUntil = Date.now() + backoffMs;
			this.client.logger?.warn?.(`[VOICE_STATUS] Rate limited, backing off for ${Math.ceil(backoffMs / 1000)}s`);
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

	private sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

	clearPendingUpdates = (voiceChannelId?: string): void => {
		if (voiceChannelId) {
			const timer = this.debounceTimers.get(voiceChannelId);
			if (timer) clearTimeout(timer);
			this.debounceTimers.delete(voiceChannelId);

			const pending = this.queue.get(voiceChannelId);
			if (pending) {
				pending.resolve(false);
				this.queue.delete(voiceChannelId);
			}
		} else {
			this.debounceTimers.forEach((timer) => clearTimeout(timer));
			this.debounceTimers.clear();
			this.queue.forEach((update) => update.resolve(false));
			this.queue.clear();
		}
	};
}
