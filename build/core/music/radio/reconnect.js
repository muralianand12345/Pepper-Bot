"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyRadioRecovery = exports.reconnectRadio = exports.consumeRadioReconnect = exports.isRadioReconnecting = void 0;
const magmastream_1 = require("magmastream");
const radio_1 = require("../repo/radio");
const func_1 = require("../func");
const session_1 = require("./session");
const locales_1 = require("../../locales");
const handlers_1 = require("../handlers");
const state_1 = require("./state");
const MAX_RECONNECTS = 3;
const BACKOFF_MS = [3_000, 8_000, 15_000];
const inFlight = new Set();
const isRadioReconnecting = (guildId) => inFlight.has(guildId);
exports.isRadioReconnecting = isRadioReconnecting;
const consumeRadioReconnect = (guildId) => inFlight.delete(guildId);
exports.consumeRadioReconnect = consumeRadioReconnect;
const reconnectRadio = async (player, client, reason) => {
    const guildId = player.guildId;
    const state = (0, state_1.getRadioState)(guildId);
    if (!state)
        return 'not_radio';
    if (inFlight.has(guildId))
        return 'reconnecting';
    const attempt = (0, state_1.markRadioReconnect)(guildId);
    if (attempt > MAX_RECONNECTS) {
        client.logger?.warn(`[RADIO] Giving up on "${state.station.name}" in guild ${guildId} after ${MAX_RECONNECTS} reconnects (${reason})`);
        await radio_1.RadioDB.recordFailure(guildId, state.station.id);
        await (0, session_1.endRadioSession)(guildId);
        return 'exhausted';
    }
    inFlight.add(guildId);
    await radio_1.RadioDB.recordReconnect(guildId, state.station.id);
    client.logger?.warn(`[RADIO] Reconnecting to "${state.station.name}" in guild ${guildId}, attempt ${attempt}/${MAX_RECONNECTS} (${reason})`);
    try {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]));
        if (!(0, state_1.getRadioState)(guildId)) {
            inFlight.delete(guildId);
            return 'not_radio';
        }
        const res = await client.manager.search(state.station.url, state.requesterId ?? client.user?.id ?? undefined);
        if (magmastream_1.TrackUtils.isErrorOrEmptySearchResult(res) || !res.tracks.length)
            throw new Error(`loadType: ${res.loadType}`);
        await player.queue.clear();
        await player.queue.setCurrent(null);
        await player.queue.add(res.tracks[0]);
        if (player.paused)
            await player.pause(false);
        await player.play();
        return 'reconnecting';
    }
    catch (error) {
        inFlight.delete(guildId);
        client.logger?.error(`[RADIO] Reconnect attempt ${attempt} failed for "${state.station.name}" in guild ${guildId}: ${error}`);
        await radio_1.RadioDB.recordFailure(guildId, state.station.id);
        return (0, exports.reconnectRadio)(player, client, `${reason} (retry ${attempt})`);
    }
};
exports.reconnectRadio = reconnectRadio;
const localeDetector = new locales_1.LocaleDetector();
const notifyRadioRecovery = async (client, player, result, stationName) => {
    if (result === 'not_radio')
        return;
    const channel = client.channels.cache.get(String(player.textChannelId));
    if (!channel?.isTextBased())
        return;
    try {
        const locale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
        const name = stationName ?? (0, state_1.getRadioState)(player.guildId)?.station.name ?? 'the station';
        const handler = new handlers_1.MusicResponseHandler(client);
        if (result === 'reconnecting') {
            const message = client.localizationManager?.translate('responses.radio.reconnecting', locale, { name }) || `📻 Lost the stream, reconnecting to ${name}...`;
            await (0, func_1.sendTempMessage)(channel, handler.createWarningContainer(message), 15000);
            return;
        }
        const message = client.localizationManager?.translate('responses.radio.reconnect_failed', locale, { name }) || `📻 ${name} went offline.`;
        await (0, func_1.sendTempMessage)(channel, handler.createErrorContainer(message, locale), 30000);
    }
    catch (error) {
        client.logger?.warn(`[RADIO] Failed to send recovery notice for guild ${player.guildId}: ${error}`);
    }
};
exports.notifyRadioRecovery = notifyRadioRecovery;
