"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFavorite = exports.resolveCandidate = void 0;
const magmastream_1 = require("magmastream");
const match_1 = require("./match");
const YOUTUBE = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const MIN_DURATION_MS = 60 * 1000;
const MAX_DURATION_MS = 12 * 60 * 1000;
const SEARCH_RESULTS_TO_CHECK = 5;
const isPlayable = (track) => !track.isStream && !YOUTUBE.test(track.uri || '') && track.duration >= MIN_DURATION_MS && track.duration <= MAX_DURATION_MS;
const markAutoplay = (track) => Object.assign(track, { isAutoplay: true });
const tracksOf = (result) => (magmastream_1.TrackUtils.isErrorOrEmptySearchResult(result) || !('tracks' in result) ? [] : result.tracks);
const requesterId = (client) => client.user?.id;
const searchByName = async (client, ref) => {
    const result = await client.manager.search(`${ref.artist} ${(0, match_1.plainTitle)(ref.title)}`, requesterId(client));
    const match = tracksOf(result)
        .slice(0, SEARCH_RESULTS_TO_CHECK)
        .find((track) => isPlayable(track) && (0, match_1.isSameSong)({ title: track.title, artist: track.author }, ref));
    return match ? markAutoplay(match) : null;
};
const loadExact = async (client, url) => {
    const track = tracksOf(await client.manager.search(url, requesterId(client)))[0];
    return track && isPlayable(track) ? markAutoplay(track) : null;
};
const resolveCandidate = async (client, player, candidate) => {
    const deezerEnabled = player.node?.info?.sourceManagers?.includes('deezer') ?? false;
    if (candidate.deezerId && deezerEnabled) {
        const exact = await loadExact(client, `https://www.deezer.com/track/${candidate.deezerId}`);
        if (exact)
            return exact;
    }
    return searchByName(client, candidate);
};
exports.resolveCandidate = resolveCandidate;
const resolveFavorite = async (client, favorite) => {
    if (favorite.uri && !YOUTUBE.test(favorite.uri)) {
        const exact = await loadExact(client, favorite.uri);
        if (exact)
            return exact;
    }
    return searchByName(client, favorite);
};
exports.resolveFavorite = resolveFavorite;
