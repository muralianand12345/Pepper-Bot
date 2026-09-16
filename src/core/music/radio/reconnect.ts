import discord from 'discord.js';
import magmastream, { TrackUtils } from 'magmastream';

import { RadioDB } from '../repo/radio';
import { sendTempMessage } from '../func';
import { endRadioSession } from './session';
import { LocaleDetector } from '../../locales';
import { MusicResponseHandler } from '../handlers';
import { getRadioState, markRadioReconnect } from './state';

const MAX_RECONNECTS = 3;
const BACKOFF_MS = [3_000, 8_000, 15_000];

const inFlight = new Set<string>();

export const isRadioReconnecting = (guildId: string): boolean => inFlight.has(guildId);

export const consumeRadioReconnect = (guildId: string): boolean => inFlight.delete(guildId);

export type RadioRecoveryResult = 'reconnecting' | 'exhausted' | 'not_radio';

export const reconnectRadio = async (player: magmastream.Player, client: discord.Client, reason: string): Promise<RadioRecoveryResult> => {
	const guildId = player.guildId;
	const state = getRadioState(guildId);
	if (!state) return 'not_radio';
	if (inFlight.has(guildId)) return 'reconnecting';

	const attempt = markRadioReconnect(guildId);
	if (attempt > MAX_RECONNECTS) {
		client.logger?.warn(`[RADIO] Giving up on "${state.station.name}" in guild ${guildId} after ${MAX_RECONNECTS} reconnects (${reason})`);
		await RadioDB.recordFailure(guildId, state.station.id);
		await endRadioSession(guildId);
		return 'exhausted';
	}

	inFlight.add(guildId);
	await RadioDB.recordReconnect(guildId, state.station.id);
	client.logger?.warn(`[RADIO] Reconnecting to "${state.station.name}" in guild ${guildId}, attempt ${attempt}/${MAX_RECONNECTS} (${reason})`);

	try {
		await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]));

		if (!getRadioState(guildId)) {
			inFlight.delete(guildId);
			return 'not_radio';
		}

		const res = await client.manager.search(state.station.url, state.requesterId ?? client.user?.id ?? undefined);
		if (TrackUtils.isErrorOrEmptySearchResult(res) || !res.tracks.length) throw new Error(`loadType: ${res.loadType}`);

		await player.queue.clear();
		await player.queue.setCurrent(null);
		await player.queue.add(res.tracks[0]);
		if (player.paused) await player.pause(false);
		await player.play();

		return 'reconnecting';
	} catch (error) {
		inFlight.delete(guildId);
		client.logger?.error(`[RADIO] Reconnect attempt ${attempt} failed for "${state.station.name}" in guild ${guildId}: ${error}`);
		await RadioDB.recordFailure(guildId, state.station.id);
		return reconnectRadio(player, client, `${reason} (retry ${attempt})`);
	}
};

const localeDetector = new LocaleDetector();

export const notifyRadioRecovery = async (client: discord.Client, player: magmastream.Player, result: RadioRecoveryResult, stationName?: string): Promise<void> => {
	if (result === 'not_radio') return;

	const channel = client.channels.cache.get(String(player.textChannelId)) as discord.TextChannel | undefined;
	if (!channel?.isTextBased()) return;

	try {
		const locale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
		const name = stationName ?? getRadioState(player.guildId)?.station.name ?? 'the station';
		const handler = new MusicResponseHandler(client);

		if (result === 'reconnecting') {
			const message = client.localizationManager?.translate('responses.radio.reconnecting', locale, { name }) || `📻 Lost the stream, reconnecting to ${name}...`;
			await sendTempMessage(channel, handler.createWarningContainer(message), 15000);
			return;
		}

		const message = client.localizationManager?.translate('responses.radio.reconnect_failed', locale, { name }) || `📻 ${name} went offline.`;
		await sendTempMessage(channel, handler.createErrorContainer(message, locale), 30000);
	} catch (error) {
		client.logger?.warn(`[RADIO] Failed to send recovery notice for guild ${player.guildId}: ${error}`);
	}
};
