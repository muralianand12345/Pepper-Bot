"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginRadioSession = exports.endRadioSession = exports.flushRadioSession = void 0;
const radio_1 = require("../repo/radio");
const state_1 = require("./state");
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const timers = new Map();
const stopTimer = (guildId) => {
    const timer = timers.get(guildId);
    if (!timer)
        return;
    clearInterval(timer);
    timers.delete(guildId);
};
const commit = async (guildId, state) => {
    const elapsed = (0, state_1.consumeRadioElapsed)(guildId);
    if (elapsed <= 0)
        return;
    await radio_1.RadioDB.addDuration(guildId, state.requesterId, state.station.id, elapsed);
};
const flushRadioSession = async (guildId) => {
    const state = (0, state_1.getRadioState)(guildId);
    if (!state)
        return stopTimer(guildId);
    await commit(guildId, state);
};
exports.flushRadioSession = flushRadioSession;
const endRadioSession = async (guildId) => {
    stopTimer(guildId);
    const state = (0, state_1.getRadioState)(guildId);
    if (!state)
        return null;
    await commit(guildId, state);
    return (0, state_1.clearRadioState)(guildId);
};
exports.endRadioSession = endRadioSession;
const beginRadioSession = async (client, guildId, station, requester) => {
    await (0, exports.endRadioSession)(guildId);
    (0, state_1.setRadioState)(guildId, station, requester?.id ?? null);
    await radio_1.RadioDB.startSession(guildId, requester, station);
    const timer = setInterval(() => {
        void (0, exports.flushRadioSession)(guildId).catch((error) => client.logger?.warn(`[RADIO] Flush failed for guild ${guildId}: ${error}`));
    }, FLUSH_INTERVAL_MS);
    timer.unref?.();
    timers.set(guildId, timer);
};
exports.beginRadioSession = beginRadioSession;
