import discord from 'discord.js';
import magmastream from 'magmastream';

import { isRadioActive } from '../radio/state';
import { clearFailures } from '../failure_guard';
import { getAutoplayConfig } from './config';
import { SongSet, primaryArtist } from './match';
import { lastfmArtistTags } from './sources';
import { AutoplayContext, buildAutoplayContext, presentTracks } from './seeds';
import { choosePicks, gatherCandidates, rankCandidates } from './picker';
import { resolveCandidate, resolveFavorite } from './resolve';
import { getAIConfig, isAutoplayAIEnabled, pickAutoplaySongs } from '../../ai';
import { AutoplayCandidate, AutoplayFavorite, AutoplaySeed, AutoplaySongRef } from '../../../types';
import { clearAutoplayStalls, getAutoplayState, isSmartAutoplayEnabled, markAutoplayStall, recordAutoplayPicks, recordAutoplaySkip, setSmartAutoplayEnabled } from './session';

export { getAutoplayConfig } from './config';
export { isSmartAutoplayEnabled } from './session';
export { isAutoplayTrack } from './seeds';

type RefillReason = 'enabled' | 'track_start' | 'queue_end';

const MAX_STALLS = 3;
const RESOLVE_ATTEMPTS_PER_SLOT = 3;
const TAGS_FOR_AI = 4;
const SKIPS_FOR_AI = 5;

const inFlight = new Map<string, Promise<number>>();
const toRef = (track: magmastream.Track): AutoplaySongRef => ({ title: track.title, artist: track.author });

const shuffleByPlays = (favorites: AutoplayFavorite[]): AutoplayFavorite[] =>
	favorites
		.map((favorite) => ({ favorite, key: Math.random() ** (1 / Math.max(1, favorite.plays)) }))
		.sort((a, b) => b.key - a.key)
		.map(({ favorite }) => favorite);

const tagNames = async (artist: string): Promise<string[]> => [...(await lastfmArtistTags(artist).catch(() => new Map<string, number>())).keys()].slice(0, TAGS_FOR_AI);

const withTags = (seeds: AutoplaySeed[]) => Promise.all(seeds.map(async (seed) => ({ title: seed.title, artist: seed.artist, tags: await tagNames(seed.artist) })));

const chooseWithAI = async (client: discord.Client, player: magmastream.Player, ctx: AutoplayContext, ranked: AutoplayCandidate[], count: number): Promise<{ ordered: AutoplayCandidate[]; mood: string } | null> => {
	if (count <= 0 || !isAutoplayAIEnabled(client)) return null;

	const pool = ranked.slice(0, getAIConfig(client).autoplay.candidates);
	const state = getAutoplayState(player);
	const [moodSongs, listenerLikes] = await Promise.all([withTags(ctx.seeds.filter((seed) => seed.origin === 'session')), withTags(ctx.seeds.filter((seed) => seed.origin !== 'session'))]);

	const result = await pickAutoplaySongs(client, {
		guildId: player.guildId,
		count,
		previousMood: state?.mood ?? null,
		moodSongs,
		listenerLikes,
		skipped: (state?.skipped ?? []).slice(0, SKIPS_FOR_AI),
		candidates: pool.map((candidate) => ({ title: candidate.title, artist: candidate.artist, tags: candidate.tags.slice(0, TAGS_FOR_AI), seedMatches: candidate.seedHits.size })),
	});
	if (!result) return null;

	const chosen = result.picks.map((index) => pool[index]);
	return { ordered: [...chosen, ...choosePicks(ranked.filter((candidate) => !chosen.includes(candidate)), count - chosen.length)], mood: result.mood };
};

const runRefill = async (client: discord.Client, player: magmastream.Player, reason: RefillReason, force: boolean): Promise<number> => {
	const guildId = player.guildId;
	if (!isSmartAutoplayEnabled(player) || isRadioActive(guildId)) return 0;

	const config = getAutoplayConfig(client);
	if (!force && (await player.queue.size()) >= config.refill_below) return 0;

	const startedAt = Date.now();
	const ctx = await buildAutoplayContext(client, player, config);
	if (!ctx.seeds.length) {
		client.logger.info(`[AUTOPLAY] No songs to base picks on for guild ${guildId} (${reason})`);
		return 0;
	}

	client.logger.debug(`[AUTOPLAY] Seeds for guild ${guildId}: ${ctx.seeds.map((seed) => `${seed.title} — ${seed.artist} (${seed.origin})`).join('; ')}`);
	const candidates = await gatherCandidates(ctx, (message) => client.logger.warn(`[AUTOPLAY] ${message}`));
	const ranked = await rankCandidates(ctx, candidates);

	const tracks: magmastream.Track[] = [];
	const batch = new SongSet();
	const batchArtists = new Set<string>();
	const accept = (track: magmastream.Track): boolean => {
		const ref = toRef(track);
		if (ctx.played.has(ref) || ctx.skipped.has(ref) || batch.has(ref)) return false;
		batch.add(ref);
		batchArtists.add(primaryArtist(track.author));
		return true;
	};

	const newCount = config.batch_size - config.favorites_per_batch;
	const aiChoice = await chooseWithAI(client, player, ctx, ranked, newCount);
	let attempts = 0;
	for (const candidate of aiChoice?.ordered ?? choosePicks(ranked, newCount)) {
		if (tracks.length >= newCount || attempts >= newCount * RESOLVE_ATTEMPTS_PER_SLOT) break;
		if (batchArtists.has(primaryArtist(candidate.artist))) continue;
		attempts++;
		const track = await resolveCandidate(client, player, candidate).catch(() => null);
		if (track && accept(track)) tracks.push(track);
	}

	const favorites: magmastream.Track[] = [];
	attempts = 0;
	for (const favorite of [...shuffleByPlays(ctx.favorites.listeners), ...shuffleByPlays(ctx.favorites.server)]) {
		if (favorites.length >= config.favorites_per_batch || attempts >= config.favorites_per_batch * RESOLVE_ATTEMPTS_PER_SLOT) break;
		attempts++;
		const track = await resolveFavorite(client, favorite).catch(() => null);
		if (track && accept(track)) favorites.push(track);
	}
	for (const favorite of favorites) tracks.splice(1 + Math.floor(Math.random() * tracks.length), 0, favorite);

	if (!tracks.length) {
		client.logger.info(`[AUTOPLAY] Nothing playable found for guild ${guildId} (${reason}, ${candidates.length} candidates)`);
		return 0;
	}

	if (client.manager.getPlayer(guildId) !== player || !isSmartAutoplayEnabled(player) || isRadioActive(guildId)) return 0;

	await player.queue.add(tracks);
	recordAutoplayPicks(player, tracks.map(toRef), aiChoice?.mood ?? null);

	const mood = [...ctx.mood.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 4)
		.map(([tag]) => tag);
	client.logger.info(`[AUTOPLAY] Queued ${tracks.length} songs for guild ${guildId} (${reason}) in ${Date.now() - startedAt}ms — seeds: ${ctx.counts.session} session, ${ctx.counts.listeners} listener, ${ctx.counts.server} server; ${candidates.length} candidates; mood: ${mood.join(', ') || 'unknown'}; picked by ${aiChoice ? `AI ("${aiChoice.mood}")` : 'score'}`);
	return tracks.length;
};

const refill = (client: discord.Client, player: magmastream.Player, reason: RefillReason, force: boolean = false): Promise<number> => {
	const existing = inFlight.get(player.guildId);
	if (existing) return existing;

	const task = runRefill(client, player, reason, force)
		.catch((error) => {
			client.logger.error(`[AUTOPLAY] Refill failed for guild ${player.guildId} (${reason}): ${error}`);
			return 0;
		})
		.finally(() => inFlight.delete(player.guildId));
	inFlight.set(player.guildId, task);
	return task;
};

export const enableSmartAutoplay = (client: discord.Client, player: magmastream.Player, userId: string): void => {
	if (player.isAutoplay) player.setAutoplay(false);
	setSmartAutoplayEnabled(player, true, userId);
	void refill(client, player, 'enabled');
};

export const disableSmartAutoplay = async (player: magmastream.Player): Promise<void> => {
	if (player.isAutoplay) player.setAutoplay(false);
	setSmartAutoplayEnabled(player, false, null);

	const tracks = await player.queue.getTracks();
	const kept = presentTracks(tracks).filter((track) => !track.isAutoplay);
	if (kept.length === tracks.length) return;
	await player.queue.clear();
	if (kept.length) await player.queue.add(kept);
};

export const autoplayInsertOffset = async (player: magmastream.Player): Promise<number | undefined> => {
	const index = (await player.queue.getTracks()).findIndex((track) => track?.isAutoplay);
	return index === -1 ? undefined : index;
};

export const noteAutoplaySkip = async (client: discord.Client, player: magmastream.Player): Promise<void> => {
	if (!isSmartAutoplayEnabled(player)) return;
	const current = await player.queue.getCurrent();
	if (!current?.isAutoplay) return;
	if (player.position >= getAutoplayConfig(client).early_skip_seconds * 1000) return;
	recordAutoplaySkip(player, toRef(current));
	client.logger.debug(`[AUTOPLAY] Early skip of "${current.title}" in guild ${player.guildId}`);
};

export const onAutoplayTrackStart = (client: discord.Client, player: magmastream.Player): void => {
	if (!isSmartAutoplayEnabled(player)) return;
	clearAutoplayStalls(player);
	void refill(client, player, 'track_start');
};

export const onAutoplayQueueEnd = async (client: discord.Client, player: magmastream.Player): Promise<boolean> => {
	if (!isSmartAutoplayEnabled(player) || isRadioActive(player.guildId)) return false;
	if (markAutoplayStall(player) > MAX_STALLS) {
		client.logger.warn(`[AUTOPLAY] Giving up in guild ${player.guildId}: picks keep failing to play`);
		return false;
	}

	for (let attempt = 0; attempt < 2 && !(await player.queue.size()); attempt++) await refill(client, player, 'queue_end', true);
	if (!(await player.queue.size()) || client.manager.getPlayer(player.guildId) !== player) return false;

	clearFailures(player.guildId);
	if (player.paused) await player.pause(false);
	await player.play();
	return true;
};

export const migrateLegacyAutoplay = (client: discord.Client, player: magmastream.Player): void => {
	if (!player.isAutoplay) return;
	const legacyUser = player.get<{ id?: string } | string | null>('Internal_AutoplayUser');
	const userId = typeof legacyUser === 'string' ? legacyUser : (legacyUser?.id ?? null);
	player.setAutoplay(false);
	setSmartAutoplayEnabled(player, true, userId);
	client.logger.info(`[AUTOPLAY] Switched restored player in guild ${player.guildId} to smart autoplay`);
};
