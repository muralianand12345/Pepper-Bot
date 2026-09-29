"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAutoplayStalls = exports.markAutoplayStall = exports.recordAutoplayPicks = exports.recordAutoplaySkip = exports.rememberAnchors = exports.setSmartAutoplayEnabled = exports.isSmartAutoplayEnabled = exports.getAutoplayState = void 0;
const STATE_KEY = 'smartAutoplay';
const MAX_ANCHORS = 10;
const MAX_SKIPPED = 50;
const MAX_PICKED = 200;
const toRef = (ref) => ({ title: ref.title, artist: ref.artist });
const getAutoplayState = (player) => {
    const state = player.get(STATE_KEY);
    if (!state || typeof state !== 'object')
        return null;
    return { enabled: !!state.enabled, enabledBy: state.enabledBy ?? null, startedAt: state.startedAt ?? Date.now(), anchors: state.anchors ?? [], skipped: state.skipped ?? [], picked: state.picked ?? [], stalls: state.stalls ?? 0, mood: state.mood ?? null };
};
exports.getAutoplayState = getAutoplayState;
const saveState = (player, state) => {
    player.set(STATE_KEY, state);
};
const updateState = (player, update) => {
    const state = (0, exports.getAutoplayState)(player);
    if (!state)
        return;
    update(state);
    saveState(player, state);
};
const isSmartAutoplayEnabled = (player) => (0, exports.getAutoplayState)(player)?.enabled === true;
exports.isSmartAutoplayEnabled = isSmartAutoplayEnabled;
const setSmartAutoplayEnabled = (player, enabled, userId) => {
    if (!enabled) {
        player.set(STATE_KEY, undefined);
        return;
    }
    const existing = (0, exports.getAutoplayState)(player);
    saveState(player, existing?.enabled ? existing : { enabled: true, enabledBy: userId, startedAt: Date.now(), anchors: [], skipped: [], picked: [], stalls: 0, mood: null });
};
exports.setSmartAutoplayEnabled = setSmartAutoplayEnabled;
const rememberAnchors = (player, anchors) => {
    updateState(player, (state) => {
        state.anchors = anchors.slice(0, MAX_ANCHORS).map(toRef);
    });
};
exports.rememberAnchors = rememberAnchors;
const recordAutoplaySkip = (player, ref) => {
    updateState(player, (state) => {
        state.skipped = [toRef(ref), ...state.skipped].slice(0, MAX_SKIPPED);
    });
};
exports.recordAutoplaySkip = recordAutoplaySkip;
const recordAutoplayPicks = (player, refs, mood) => {
    updateState(player, (state) => {
        state.picked = [...refs.map(toRef), ...state.picked].slice(0, MAX_PICKED);
        if (mood)
            state.mood = mood;
    });
};
exports.recordAutoplayPicks = recordAutoplayPicks;
const markAutoplayStall = (player) => {
    let stalls = 0;
    updateState(player, (state) => {
        state.stalls += 1;
        stalls = state.stalls;
    });
    return stalls;
};
exports.markAutoplayStall = markAutoplayStall;
const clearAutoplayStalls = (player) => {
    updateState(player, (state) => {
        state.stalls = 0;
    });
};
exports.clearAutoplayStalls = clearAutoplayStalls;
