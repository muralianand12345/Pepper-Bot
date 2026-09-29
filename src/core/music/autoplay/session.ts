import magmastream from 'magmastream';

import { AutoplaySessionState, AutoplaySongRef } from '../../../types';

const STATE_KEY = 'smartAutoplay';
const MAX_ANCHORS = 10;
const MAX_SKIPPED = 50;
const MAX_PICKED = 200;

const toRef = (ref: AutoplaySongRef): AutoplaySongRef => ({ title: ref.title, artist: ref.artist });

export const getAutoplayState = (player: magmastream.Player): AutoplaySessionState | null => {
	const state = player.get<AutoplaySessionState | undefined>(STATE_KEY);
	if (!state || typeof state !== 'object') return null;
	return { enabled: !!state.enabled, enabledBy: state.enabledBy ?? null, startedAt: state.startedAt ?? Date.now(), anchors: state.anchors ?? [], skipped: state.skipped ?? [], picked: state.picked ?? [], stalls: state.stalls ?? 0, mood: state.mood ?? null };
};

const saveState = (player: magmastream.Player, state: AutoplaySessionState): void => {
	player.set(STATE_KEY, state);
};

const updateState = (player: magmastream.Player, update: (state: AutoplaySessionState) => void): void => {
	const state = getAutoplayState(player);
	if (!state) return;
	update(state);
	saveState(player, state);
};

export const isSmartAutoplayEnabled = (player: magmastream.Player): boolean => getAutoplayState(player)?.enabled === true;

export const setSmartAutoplayEnabled = (player: magmastream.Player, enabled: boolean, userId: string | null): void => {
	if (!enabled) {
		player.set(STATE_KEY, undefined);
		return;
	}
	const existing = getAutoplayState(player);
	saveState(player, existing?.enabled ? existing : { enabled: true, enabledBy: userId, startedAt: Date.now(), anchors: [], skipped: [], picked: [], stalls: 0, mood: null });
};

export const rememberAnchors = (player: magmastream.Player, anchors: AutoplaySongRef[]): void => {
	updateState(player, (state) => {
		state.anchors = anchors.slice(0, MAX_ANCHORS).map(toRef);
	});
};

export const recordAutoplaySkip = (player: magmastream.Player, ref: AutoplaySongRef): void => {
	updateState(player, (state) => {
		state.skipped = [toRef(ref), ...state.skipped].slice(0, MAX_SKIPPED);
	});
};

export const recordAutoplayPicks = (player: magmastream.Player, refs: AutoplaySongRef[], mood: string | null): void => {
	updateState(player, (state) => {
		state.picked = [...refs.map(toRef), ...state.picked].slice(0, MAX_PICKED);
		if (mood) state.mood = mood;
	});
};

export const markAutoplayStall = (player: magmastream.Player): number => {
	let stalls = 0;
	updateState(player, (state) => {
		state.stalls += 1;
		stalls = state.stalls;
	});
	return stalls;
};

export const clearAutoplayStalls = (player: magmastream.Player): void => {
	updateState(player, (state) => {
		state.stalls = 0;
	});
};
