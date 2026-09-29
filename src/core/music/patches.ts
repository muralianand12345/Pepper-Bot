import discord from 'discord.js';
import magmastream, { Node, Player } from 'magmastream';

import { remainingCooldown } from './failure_guard';
import { canRetryStuck, refreshStream } from './stream_refresh';

let applied = false;

type TrackStart = (player: magmastream.Player, track: magmastream.Track | null, payload: magmastream.TrackStartEvent) => void;
type Play = (...args: unknown[]) => Promise<unknown>;
type TrackStuck = (player: magmastream.Player, track: magmastream.Track | null, payload: magmastream.TrackStuckEvent) => Promise<void>;
type Open = (...args: unknown[]) => unknown;

const KEEPALIVE_INTERVAL_MS = 15_000;
const SOCKET_OPEN = 1;

const patchTrackStart = (client: discord.Client): boolean => {
	const proto = (Node as unknown as { prototype?: Record<string, unknown> })?.prototype;
	const original = proto?.trackStart as TrackStart | undefined;
	if (typeof original !== 'function') return false;

	proto!.trackStart = function (this: unknown, player: magmastream.Player, track: magmastream.Track | null, payload: magmastream.TrackStartEvent) {
		if (!track) {
			client.logger?.debug(`[PATCH] Dropped TrackStartEvent with no current track for guild ${player?.guildId ?? 'unknown'} (player torn down mid-event)`);
			return;
		}
		return original.call(this, player, track, payload);
	} as TrackStart;

	return true;
};

const patchTrackStuck = (client: discord.Client): boolean => {
	const proto = (Node as unknown as { prototype?: Record<string, unknown> })?.prototype;
	const original = proto?.trackStuck as TrackStuck | undefined;
	if (typeof original !== 'function') return false;

	proto!.trackStuck = async function (this: unknown, player: magmastream.Player, track: magmastream.Track | null, payload: magmastream.TrackStuckEvent) {
		if (track && player?.guildId && canRetryStuck(player.guildId, track)) {
			client.logger?.warn(`[PATCH] Track ${track.title ?? 'Unknown'} stalled for ${payload?.thresholdMs ?? 'unknown'}ms in guild ${player.guildId}; retrying it on a fresh stream before skipping`);
			const refreshed = await refreshStream(player, client, 'recovering from a stalled stream');
			if (refreshed) return;
		}
		return original.call(this, player, track, payload);
	} as TrackStuck;

	return true;
};

const patchPlayCooldown = (client: discord.Client): boolean => {
	const proto = (Player as unknown as { prototype?: Record<string, unknown> })?.prototype;
	const original = proto?.play as Play | undefined;
	if (typeof original !== 'function') return false;

	proto!.play = async function (this: magmastream.Player, ...args: unknown[]) {
		const wait = this?.guildId ? remainingCooldown(this.guildId) : 0;
		if (wait > 0) {
			client.logger?.debug(`[PATCH] Holding playback for guild ${this.guildId} for ${wait}ms after a playback failure`);
			await new Promise((resolve) => setTimeout(resolve, wait));
		}
		return original.apply(this, args);
	} as Play;

	return true;
};

// Some node connections die silently after a few quiet minutes: REST still works, but track events stop arriving.
const patchNodeKeepalive = (client: discord.Client): boolean => {
	const proto = (Node as unknown as { prototype?: Record<string, unknown> })?.prototype;
	const original = proto?.open as Open | undefined;
	if (typeof original !== 'function') return false;

	proto!.open = function (this: magmastream.Node, ...args: unknown[]) {
		const socket = this.socket;
		if (socket) {
			let alive = true;
			socket.on('pong', () => {
				alive = true;
			});
			const timer = setInterval(() => {
				if (socket.readyState !== SOCKET_OPEN) return clearInterval(timer);
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
	} as Open;

	return true;
};

export const applyMagmastreamPatches = (client: discord.Client): void => {
	if (applied) return;
	applied = true;

	const results = [
		['trackStart null-track guard', patchTrackStart(client)],
		['trackStuck stream refresh', patchTrackStuck(client)],
		['play failure cooldown', patchPlayCooldown(client)],
		['node keepalive ping', patchNodeKeepalive(client)],
	] as const;

	for (const [name, ok] of results) {
		if (ok) client.logger?.info(`[PATCH] Applied ${name}`);
		else client.logger?.warn(`[PATCH] Skipped ${name} — magmastream internals changed, check whether the patch is still needed`);
	}
};
