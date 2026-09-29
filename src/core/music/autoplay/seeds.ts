import discord from 'discord.js';
import magmastream from 'magmastream';

import { MusicDB } from '../repo';
import { getRequester, isBotRequester } from '../func';
import { getAutoplayState, rememberAnchors } from './session';
import { SongSet, isVariant, primaryArtist } from './match';
import { lastfmArtistTags, tagSimilarity } from './sources';
import { AutoplayFavorite, AutoplaySeed, AutoplaySongRef, IAutoplayConfig, ISongs } from '../../../types';

const DAY = 24 * 60 * 60 * 1000;
// Strict on purpose: Hindi film artists score ~0.35–0.42 against a Tamil mood, Tamil ones 0.55+.
const MOOD_FIT_THRESHOLD = 0.45;
const LISTENER_SEED_WEIGHT = 0.6;
const SERVER_SEED_WEIGHT = 0.4;
const FALLBACK_SEED_WEIGHT = 0.8;
const MAX_ANCHORS = 10;
const MAX_LISTENERS = 10;
const TOP_SONGS_PER_LISTENER = 25;
const TOP_SONGS_FOR_SERVER = 30;
const FAVORITES_TO_CHECK = 15;

export interface AutoplayContext {
	seeds: AutoplaySeed[];
	favorites: { listeners: AutoplayFavorite[]; server: AutoplayFavorite[] };
	played: SongSet;
	skipped: SongSet;
	skippedArtists: Set<string>;
	recentArtists: Set<string>;
	allowVariants: boolean;
	mood: Map<string, number>;
	counts: { session: number; listeners: number; server: number };
}

const toRef = (track: magmastream.Track): AutoplaySongRef => ({ title: track.title, artist: track.author });

const songToRef = (song: ISongs): AutoplaySongRef => ({ title: song.title, artist: song.author });

// magmastream can store null entries (e.g. in previous tracks after a track ends with no current track).
export const presentTracks = (tracks: Array<magmastream.Track | null | undefined>): magmastream.Track[] => tracks.filter((track): track is magmastream.Track => !!track);

export const isAutoplayTrack = (client: discord.Client, track: magmastream.Track): boolean => track.isAutoplay || isBotRequester(client, getRequester(client, track.requester));

const dedupeBy = <T>(items: T[], refOf: (item: T) => AutoplaySongRef): T[] => {
	const seen = new SongSet();
	return items.filter((item) => {
		const ref = refOf(item);
		if (seen.has(ref)) return false;
		seen.add(ref);
		return true;
	});
};

const dedupe = <T extends AutoplaySongRef>(refs: T[]): T[] => dedupeBy(refs, (ref) => ref);

const safeTags = (artist: string): Promise<Map<string, number>> => lastfmArtistTags(artist).catch(() => new Map<string, number>());

const buildMood = async (seeds: AutoplaySeed[]): Promise<Map<string, number>> => {
	const mood = new Map<string, number>();
	const tagSets = await Promise.all(seeds.map((seed) => safeTags(seed.artist)));
	seeds.forEach((seed, index) => {
		for (const [tag, weight] of tagSets[index]) mood.set(tag, (mood.get(tag) ?? 0) + weight * seed.weight);
	});
	const max = Math.max(0, ...mood.values());
	if (max > 0) for (const [tag, weight] of mood) mood.set(tag, weight / max);
	return mood;
};

const roundRobin = <T>(lists: T[][]): T[] => {
	const merged: T[] = [];
	const longest = Math.max(0, ...lists.map((list) => list.length));
	for (let index = 0; index < longest; index++) for (const list of lists) if (list[index]) merged.push(list[index]);
	return merged;
};

const listenerIds = (client: discord.Client, player: magmastream.Player): string[] => {
	const channel = player.voiceChannelId ? client.channels.cache.get(player.voiceChannelId) : null;
	if (!channel?.isVoiceBased()) return [];
	return [...channel.members.filter((member) => !member.user.bot).keys()].slice(0, MAX_LISTENERS);
};

export const buildAutoplayContext = async (client: discord.Client, player: magmastream.Player, config: IAutoplayConfig): Promise<AutoplayContext> => {
	const [current, previous, queued] = await Promise.all([player.queue.getCurrent(), player.queue.getPrevious(), player.queue.getTracks()]);
	const state = getAutoplayState(player);
	const upcoming = presentTracks(queued);
	const history = presentTracks(previous).reverse();
	const nowAndBefore = [...(current ? [current] : []), ...history].filter((track) => !track.isStream);

	const humanRecent = [...[...upcoming].reverse(), ...nowAndBefore].filter((track) => !track.isStream && !isAutoplayTrack(client, track)).map(toRef);
	const anchors = dedupe([...humanRecent, ...(state?.anchors ?? [])]).slice(0, MAX_ANCHORS);
	rememberAnchors(player, anchors);

	const played = new SongSet([...upcoming, ...nowAndBefore].map(toRef));
	for (const ref of [...anchors, ...(state?.picked ?? [])]) played.add(ref);
	const skipped = new SongSet(state?.skipped ?? []);
	const skippedArtists = new Set((state?.skipped ?? []).map((ref) => primaryArtist(ref.artist)).filter(Boolean));
	const recentArtists = new Set(nowAndBefore.slice(0, 3).map((track) => primaryArtist(track.author)).filter(Boolean));

	let sessionSeeds: AutoplaySeed[] = anchors.slice(0, config.seeds.session).map((ref, index) => ({ ...ref, origin: 'session', weight: Math.max(0.5, 1 - index * 0.1) }));
	if (!sessionSeeds.length) sessionSeeds = dedupe(nowAndBefore.map(toRef)).slice(0, 3).map((ref) => ({ ...ref, origin: 'session', weight: FALLBACK_SEED_WEIGHT }));

	const mood = await buildMood(sessionSeeds);
	const sessionArtists = new Set(sessionSeeds.map((seed) => primaryArtist(seed.artist)));
	const requireFit = sessionSeeds.length > 0;

	const fits = async (ref: AutoplaySongRef): Promise<boolean> => {
		if (!requireFit || sessionArtists.has(primaryArtist(ref.artist))) return true;
		if (!mood.size) return false;
		return tagSimilarity(await safeTags(ref.artist), mood) >= MOOD_FIT_THRESHOLD;
	};

	const cutoff = Date.now() - config.history_days * DAY;
	const isFresh = (song: ISongs): boolean => !song.isStream && !!song.uri && new Date(song.timestamp).getTime() >= cutoff && !played.has(songToRef(song)) && !skipped.has(songToRef(song));
	const toFavorite = (song: ISongs): AutoplayFavorite => ({ title: song.title, artist: song.author, uri: song.uri, plays: song.played_number });

	const filterFitting = async (songs: ISongs[]): Promise<AutoplayFavorite[]> => {
		const checks = await Promise.all(songs.map((song) => fits(songToRef(song))));
		return songs.filter((_, index) => checks[index]).map(toFavorite);
	};

	const listenerLists = await Promise.all(listenerIds(client, player).map((id) => MusicDB.getUserTopSongs(id, TOP_SONGS_PER_LISTENER).catch(() => [] as ISongs[])));
	const listenerFavorites = await filterFitting(dedupeBy(roundRobin(listenerLists.map((list) => list.filter(isFresh))), songToRef).slice(0, FAVORITES_TO_CHECK));

	const listenerSet = new SongSet(listenerFavorites);
	const serverSongs = await MusicDB.getGuildTopSongs(player.guildId, TOP_SONGS_FOR_SERVER).catch(() => [] as ISongs[]);
	const serverFavorites = await filterFitting(serverSongs.filter((song) => isFresh(song) && !listenerSet.has(songToRef(song)) && !isBotRequester(client, song.requester ?? null)).slice(0, FAVORITES_TO_CHECK));

	const listenerSeeds: AutoplaySeed[] = listenerFavorites.slice(0, config.seeds.listeners).map((fav) => ({ title: fav.title, artist: fav.artist, origin: 'listener', weight: LISTENER_SEED_WEIGHT }));
	const serverSeeds: AutoplaySeed[] = serverFavorites.slice(0, config.seeds.server).map((fav) => ({ title: fav.title, artist: fav.artist, origin: 'server', weight: SERVER_SEED_WEIGHT }));
	const seeds = dedupe([...sessionSeeds, ...listenerSeeds, ...serverSeeds]);

	return {
		seeds,
		favorites: { listeners: listenerFavorites, server: serverFavorites },
		played,
		skipped,
		skippedArtists,
		recentArtists,
		allowVariants: sessionSeeds.some((seed) => isVariant(seed.title)),
		mood,
		counts: { session: seeds.filter((seed) => seed.origin === 'session').length, listeners: seeds.filter((seed) => seed.origin === 'listener').length, server: seeds.filter((seed) => seed.origin === 'server').length },
	};
};
