"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeRadioElapsed = exports.getRadioElapsed = exports.clearRadioState = exports.markRadioReconnect = exports.getRadioStation = exports.isRadioActive = exports.getRadioState = exports.setRadioState = void 0;
const states = new Map();
const setRadioState = (guildId, station, requesterId) => {
    const now = Date.now();
    const state = { station, startedAt: now, lastFlushAt: now, requesterId, reconnects: 0, lastReconnectAt: 0 };
    states.set(guildId, state);
    return state;
};
exports.setRadioState = setRadioState;
const getRadioState = (guildId) => states.get(guildId) ?? null;
exports.getRadioState = getRadioState;
const isRadioActive = (guildId) => states.has(guildId);
exports.isRadioActive = isRadioActive;
const getRadioStation = (guildId) => states.get(guildId)?.station ?? null;
exports.getRadioStation = getRadioStation;
const RECONNECT_WINDOW_MS = 10 * 60 * 1000;
const markRadioReconnect = (guildId) => {
    const state = states.get(guildId);
    if (!state)
        return 0;
    const now = Date.now();
    if (state.lastReconnectAt && now - state.lastReconnectAt > RECONNECT_WINDOW_MS)
        state.reconnects = 0;
    state.reconnects += 1;
    state.lastReconnectAt = now;
    return state.reconnects;
};
exports.markRadioReconnect = markRadioReconnect;
const clearRadioState = (guildId) => {
    const state = states.get(guildId) ?? null;
    states.delete(guildId);
    return state;
};
exports.clearRadioState = clearRadioState;
const getRadioElapsed = (guildId) => {
    const state = states.get(guildId);
    return state ? Date.now() - state.startedAt : 0;
};
exports.getRadioElapsed = getRadioElapsed;
const consumeRadioElapsed = (guildId) => {
    const state = states.get(guildId);
    if (!state)
        return 0;
    const now = Date.now();
    const elapsed = now - state.lastFlushAt;
    state.lastFlushAt = now;
    return Math.max(0, elapsed);
};
exports.consumeRadioElapsed = consumeRadioElapsed;
