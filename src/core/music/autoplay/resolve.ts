import discord from 'discord.js';
import magmastream, { TrackUtils } from 'magmastream';

import { isSameSong, plainTitle } from './match';
import { AutoplayCandidate, AutoplayFavorite, AutoplaySongRef } from '../../../types';

const YOUTUBE = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const MIN_DURATION_MS = 60 * 1000;
const MAX_DURATION_MS = 12 * 60 * 1000;
const SEARCH_RESULTS_TO_CHECK = 5;

const isPlayable = (track: magmastream.Track): boolean => !track.isStream && !YOUTUBE.test(track.uri || '') && track.duration >= MIN_DURATION_MS && track.duration <= MAX_DURATION_MS;

const markAutoplay = (track: magmastream.Track): magmastream.Track => Object.assign(track, { isAutoplay: true });

const tracksOf = (result: magmastream.SearchResult): magmastream.Track[] => (TrackUtils.isErrorOrEmptySearchResult(result) || !('tracks' in result) ? [] : result.tracks);

const requesterId = (client: discord.Client): string | undefined => client.user?.id;

const searchByName = async (client: discord.Client, ref: AutoplaySongRef): Promise<magmastream.Track | null> => {
	const result = await client.manager.search(`${ref.artist} ${plainTitle(ref.title)}`, requesterId(client));
	const match = tracksOf(result)
		.slice(0, SEARCH_RESULTS_TO_CHECK)
		.find((track) => isPlayable(track) && isSameSong({ title: track.title, artist: track.author }, ref));
	return match ? markAutoplay(match) : null;
};

const loadExact = async (client: discord.Client, url: string): Promise<magmastream.Track | null> => {
	const track = tracksOf(await client.manager.search(url, requesterId(client)))[0];
	return track && isPlayable(track) ? markAutoplay(track) : null;
};

export const resolveCandidate = async (client: discord.Client, player: magmastream.Player, candidate: AutoplayCandidate): Promise<magmastream.Track | null> => {
	const deezerEnabled = player.node?.info?.sourceManagers?.includes('deezer') ?? false;
	if (candidate.deezerId && deezerEnabled) {
		const exact = await loadExact(client, `https://www.deezer.com/track/${candidate.deezerId}`);
		if (exact) return exact;
	}
	return searchByName(client, candidate);
};

export const resolveFavorite = async (client: discord.Client, favorite: AutoplayFavorite): Promise<magmastream.Track | null> => {
	if (favorite.uri && !YOUTUBE.test(favorite.uri)) {
		const exact = await loadExact(client, favorite.uri);
		if (exact) return exact;
	}
	return searchByName(client, favorite);
};
