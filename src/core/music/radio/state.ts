import { RadioState, RadioStation } from '../../../types';

const states = new Map<string, RadioState>();

export const setRadioState = (guildId: string, station: RadioStation, requesterId: string | null): RadioState => {
	const now = Date.now();
	const state: RadioState = { station, startedAt: now, lastFlushAt: now, requesterId, reconnects: 0, lastReconnectAt: 0 };
	states.set(guildId, state);
	return state;
};

export const getRadioState = (guildId: string): RadioState | null => states.get(guildId) ?? null;

export const isRadioActive = (guildId: string): boolean => states.has(guildId);

export const getRadioStation = (guildId: string): RadioStation | null => states.get(guildId)?.station ?? null;

const RECONNECT_WINDOW_MS = 10 * 60 * 1000;

export const markRadioReconnect = (guildId: string): number => {
	const state = states.get(guildId);
	if (!state) return 0;
	const now = Date.now();
	if (state.lastReconnectAt && now - state.lastReconnectAt > RECONNECT_WINDOW_MS) state.reconnects = 0;
	state.reconnects += 1;
	state.lastReconnectAt = now;
	return state.reconnects;
};

export const clearRadioState = (guildId: string): RadioState | null => {
	const state = states.get(guildId) ?? null;
	states.delete(guildId);
	return state;
};

export const getRadioElapsed = (guildId: string): number => {
	const state = states.get(guildId);
	return state ? Date.now() - state.startedAt : 0;
};

export const consumeRadioElapsed = (guildId: string): number => {
	const state = states.get(guildId);
	if (!state) return 0;
	const now = Date.now();
	const elapsed = now - state.lastFlushAt;
	state.lastFlushAt = now;
	return Math.max(0, elapsed);
};
