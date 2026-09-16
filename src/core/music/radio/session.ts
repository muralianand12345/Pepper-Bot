import discord from 'discord.js';

import { RadioDB } from '../repo/radio';
import { ISongsUser, RadioState, RadioStation } from '../../../types';
import { clearRadioState, consumeRadioElapsed, getRadioState, setRadioState } from './state';

const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

const timers = new Map<string, NodeJS.Timeout>();

const stopTimer = (guildId: string): void => {
	const timer = timers.get(guildId);
	if (!timer) return;
	clearInterval(timer);
	timers.delete(guildId);
};

const commit = async (guildId: string, state: RadioState): Promise<void> => {
	const elapsed = consumeRadioElapsed(guildId);
	if (elapsed <= 0) return;
	await RadioDB.addDuration(guildId, state.requesterId, state.station.id, elapsed);
};

export const flushRadioSession = async (guildId: string): Promise<void> => {
	const state = getRadioState(guildId);
	if (!state) return stopTimer(guildId);
	await commit(guildId, state);
};

export const endRadioSession = async (guildId: string): Promise<RadioState | null> => {
	stopTimer(guildId);
	const state = getRadioState(guildId);
	if (!state) return null;
	await commit(guildId, state);
	return clearRadioState(guildId);
};

export const beginRadioSession = async (client: discord.Client, guildId: string, station: RadioStation, requester: ISongsUser | null): Promise<void> => {
	await endRadioSession(guildId);

	setRadioState(guildId, station, requester?.id ?? null);
	await RadioDB.startSession(guildId, requester, station);

	const timer = setInterval(() => {
		void flushRadioSession(guildId).catch((error) => client.logger?.warn(`[RADIO] Flush failed for guild ${guildId}: ${error}`));
	}, FLUSH_INTERVAL_MS);
	timer.unref?.();
	timers.set(guildId, timer);
};
