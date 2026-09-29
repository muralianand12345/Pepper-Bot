"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMagmastreamPatches = void 0;
const magmastream_1 = require("magmastream");
const failure_guard_1 = require("./failure_guard");
const stream_refresh_1 = require("./stream_refresh");
let applied = false;
const KEEPALIVE_INTERVAL_MS = 15_000;
const SOCKET_OPEN = 1;
const patchTrackStart = (client) => {
    const proto = magmastream_1.Node?.prototype;
    const original = proto?.trackStart;
    if (typeof original !== 'function')
        return false;
    proto.trackStart = function (player, track, payload) {
        if (!track) {
            client.logger?.debug(`[PATCH] Dropped TrackStartEvent with no current track for guild ${player?.guildId ?? 'unknown'} (player torn down mid-event)`);
            return;
        }
        return original.call(this, player, track, payload);
    };
    return true;
};
const patchTrackStuck = (client) => {
    const proto = magmastream_1.Node?.prototype;
    const original = proto?.trackStuck;
    if (typeof original !== 'function')
        return false;
    proto.trackStuck = async function (player, track, payload) {
        if (track && player?.guildId && (0, stream_refresh_1.canRetryStuck)(player.guildId, track)) {
            client.logger?.warn(`[PATCH] Track ${track.title ?? 'Unknown'} stalled for ${payload?.thresholdMs ?? 'unknown'}ms in guild ${player.guildId}; retrying it on a fresh stream before skipping`);
            const refreshed = await (0, stream_refresh_1.refreshStream)(player, client, 'recovering from a stalled stream');
            if (refreshed)
                return;
        }
        return original.call(this, player, track, payload);
    };
    return true;
};
const patchPlayCooldown = (client) => {
    const proto = magmastream_1.Player?.prototype;
    const original = proto?.play;
    if (typeof original !== 'function')
        return false;
    proto.play = async function (...args) {
        const wait = this?.guildId ? (0, failure_guard_1.remainingCooldown)(this.guildId) : 0;
        if (wait > 0) {
            client.logger?.debug(`[PATCH] Holding playback for guild ${this.guildId} for ${wait}ms after a playback failure`);
            await new Promise((resolve) => setTimeout(resolve, wait));
        }
        return original.apply(this, args);
    };
    return true;
};
// Some node connections die silently after a few quiet minutes: REST still works, but track events stop arriving.
const patchNodeKeepalive = (client) => {
    const proto = magmastream_1.Node?.prototype;
    const original = proto?.open;
    if (typeof original !== 'function')
        return false;
    proto.open = function (...args) {
        const socket = this.socket;
        if (socket) {
            let alive = true;
            socket.on('pong', () => {
                alive = true;
            });
            const timer = setInterval(() => {
                if (socket.readyState !== SOCKET_OPEN)
                    return clearInterval(timer);
                if (!alive) {
                    client.logger?.warn(`[PATCH] Node ${this.options.identifier} stopped answering pings; reconnecting`);
                    clearInterval(timer);
                    socket.terminate();
                    return;
                }
                alive = false;
                socket.ping();
            }, KEEPALIVE_INTERVAL_MS);
            timer.unref?.();
            socket.once('close', () => clearInterval(timer));
        }
        return original.apply(this, args);
    };
    return true;
};
const applyMagmastreamPatches = (client) => {
    if (applied)
        return;
    applied = true;
    const results = [
        ['trackStart null-track guard', patchTrackStart(client)],
        ['trackStuck stream refresh', patchTrackStuck(client)],
        ['play failure cooldown', patchPlayCooldown(client)],
        ['node keepalive ping', patchNodeKeepalive(client)],
    ];
    for (const [name, ok] of results) {
        if (ok)
            client.logger?.info(`[PATCH] Applied ${name}`);
        else
            client.logger?.warn(`[PATCH] Skipped ${name} — magmastream internals changed, check whether the patch is still needed`);
    }
};
exports.applyMagmastreamPatches = applyMagmastreamPatches;
