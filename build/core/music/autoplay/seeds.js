"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAutoplayContext = exports.isAutoplayTrack = exports.presentTracks = void 0;
const repo_1 = require("../repo");
const func_1 = require("../func");
const session_1 = require("./session");
const match_1 = require("./match");
const sources_1 = require("./sources");
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
const toRef = (track) => ({ title: track.title, artist: track.author });
const songToRef = (song) => ({ title: song.title, artist: song.author });
// magmastream can store null entries (e.g. in previous tracks after a track ends with no current track).
const presentTracks = (tracks) => tracks.filter((track) => !!track);
exports.presentTracks = presentTracks;
const isAutoplayTrack = (client, track) => track.isAutoplay || (0, func_1.isBotRequester)(client, (0, func_1.getRequester)(client, track.requester));
exports.isAutoplayTrack = isAutoplayTrack;
const dedupeBy = (items, refOf) => {
    const seen = new match_1.SongSet();
    return items.filter((item) => {
        const ref = refOf(item);
        if (seen.has(ref))
            return false;
        seen.add(ref);
        return true;
    });
};
const dedupe = (refs) => dedupeBy(refs, (ref) => ref);
const safeTags = (artist) => (0, sources_1.lastfmArtistTags)(artist).catch(() => new Map());
const buildMood = async (seeds) => {
    const mood = new Map();
    const tagSets = await Promise.all(seeds.map((seed) => safeTags(seed.artist)));
    seeds.forEach((seed, index) => {
        for (const [tag, weight] of tagSets[index])
            mood.set(tag, (mood.get(tag) ?? 0) + weight * seed.weight);
    });
    const max = Math.max(0, ...mood.values());
    if (max > 0)
        for (const [tag, weight] of mood)
            mood.set(tag, weight / max);
    return mood;
};
const roundRobin = (lists) => {
    const merged = [];
    const longest = Math.max(0, ...lists.map((list) => list.length));
    for (let index = 0; index < longest; index++)
        for (const list of lists)
            if (list[index])
                merged.push(list[index]);
    return merged;
};
const listenerIds = (client, player) => {
    const channel = player.voiceChannelId ? client.channels.cache.get(player.voiceChannelId) : null;
    if (!channel?.isVoiceBased())
        return [];
    return [...channel.members.filter((member) => !member.user.bot).keys()].slice(0, MAX_LISTENERS);
};
const buildAutoplayContext = async (client, player, config) => {
    const [current, previous, queued] = await Promise.all([player.queue.getCurrent(), player.queue.getPrevious(), player.queue.getTracks()]);
    const state = (0, session_1.getAutoplayState)(player);
    const upcoming = (0, exports.presentTracks)(queued);
    const history = (0, exports.presentTracks)(previous).reverse();
    const nowAndBefore = [...(current ? [current] : []), ...history].filter((track) => !track.isStream);
    const humanRecent = [...[...upcoming].reverse(), ...nowAndBefore].filter((track) => !track.isStream && !(0, exports.isAutoplayTrack)(client, track)).map(toRef);
    const anchors = dedupe([...humanRecent, ...(state?.anchors ?? [])]).slice(0, MAX_ANCHORS);
    (0, session_1.rememberAnchors)(player, anchors);
    const played = new match_1.SongSet([...upcoming, ...nowAndBefore].map(toRef));
    for (const ref of [...anchors, ...(state?.picked ?? [])])
        played.add(ref);
    const skipped = new match_1.SongSet(state?.skipped ?? []);
    const skippedArtists = new Set((state?.skipped ?? []).map((ref) => (0, match_1.primaryArtist)(ref.artist)).filter(Boolean));
    const recentArtists = new Set(nowAndBefore.slice(0, 3).map((track) => (0, match_1.primaryArtist)(track.author)).filter(Boolean));
    let sessionSeeds = anchors.slice(0, config.seeds.session).map((ref, index) => ({ ...ref, origin: 'session', weight: Math.max(0.5, 1 - index * 0.1) }));
    if (!sessionSeeds.length)
        sessionSeeds = dedupe(nowAndBefore.map(toRef)).slice(0, 3).map((ref) => ({ ...ref, origin: 'session', weight: FALLBACK_SEED_WEIGHT }));
    const mood = await buildMood(sessionSeeds);
    const sessionArtists = new Set(sessionSeeds.map((seed) => (0, match_1.primaryArtist)(seed.artist)));
    const requireFit = sessionSeeds.length > 0;
    const fits = async (ref) => {
        if (!requireFit || sessionArtists.has((0, match_1.primaryArtist)(ref.artist)))
            return true;
        if (!mood.size)
            return false;
        return (0, sources_1.tagSimilarity)(await safeTags(ref.artist), mood) >= MOOD_FIT_THRESHOLD;
    };
    const cutoff = Date.now() - config.history_days * DAY;
    const isFresh = (song) => !song.isStream && !!song.uri && new Date(song.timestamp).getTime() >= cutoff && !played.has(songToRef(song)) && !skipped.has(songToRef(song));
    const toFavorite = (song) => ({ title: song.title, artist: song.author, uri: song.uri, plays: song.played_number });
    const filterFitting = async (songs) => {
        const checks = await Promise.all(songs.map((song) => fits(songToRef(song))));
        return songs.filter((_, index) => checks[index]).map(toFavorite);
    };
    const listenerLists = await Promise.all(listenerIds(client, player).map((id) => repo_1.MusicDB.getUserTopSongs(id, TOP_SONGS_PER_LISTENER).catch(() => [])));
    const listenerFavorites = await filterFitting(dedupeBy(roundRobin(listenerLists.map((list) => list.filter(isFresh))), songToRef).slice(0, FAVORITES_TO_CHECK));
    const listenerSet = new match_1.SongSet(listenerFavorites);
    const serverSongs = await repo_1.MusicDB.getGuildTopSongs(player.guildId, TOP_SONGS_FOR_SERVER).catch(() => []);
    const serverFavorites = await filterFitting(serverSongs.filter((song) => isFresh(song) && !listenerSet.has(songToRef(song)) && !(0, func_1.isBotRequester)(client, song.requester ?? null)).slice(0, FAVORITES_TO_CHECK));
    const listenerSeeds = listenerFavorites.slice(0, config.seeds.listeners).map((fav) => ({ title: fav.title, artist: fav.artist, origin: 'listener', weight: LISTENER_SEED_WEIGHT }));
    const serverSeeds = serverFavorites.slice(0, config.seeds.server).map((fav) => ({ title: fav.title, artist: fav.artist, origin: 'server', weight: SERVER_SEED_WEIGHT }));
    const seeds = dedupe([...sessionSeeds, ...listenerSeeds, ...serverSeeds]);
    return {
        seeds,
        favorites: { listeners: listenerFavorites, server: serverFavorites },
        played,
        skipped,
        skippedArtists,
        recentArtists,
        allowVariants: sessionSeeds.some((seed) => (0, match_1.isVariant)(seed.title)),
        mood,
        counts: { session: seeds.filter((seed) => seed.origin === 'session').length, listeners: seeds.filter((seed) => seed.origin === 'listener').length, server: seeds.filter((seed) => seed.origin === 'server').length },
    };
};
exports.buildAutoplayContext = buildAutoplayContext;
