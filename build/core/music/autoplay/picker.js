"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.choosePicks = exports.rankCandidates = exports.gatherCandidates = exports.mapLimit = void 0;
const match_1 = require("./match");
const sources_1 = require("./sources");
const CONCURRENCY = 4;
const DEEZER_RELATED_STRENGTH = 0.5;
const DEEZER_SAME_ARTIST_STRENGTH = 0.3;
const MIN_DURATION_S = 60;
const MAX_DURATION_S = 12 * 60;
const CANDIDATES_TO_RANK = 25;
const CONSENSUS_BONUS = 0.25;
const OFF_MOOD_SIMILARITY = 0.1;
const OFF_MOOD_FACTOR = 0.1;
const UNTAGGED_FACTOR = 0.7;
const SKIPPED_ARTIST_FACTOR = 0.3;
const RECENT_ARTIST_FACTOR = 0.7;
const mapLimit = async (items, limit, fn) => {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};
exports.mapLimit = mapLimit;
const gatherCandidates = async (ctx, onError) => {
    const pool = new Map();
    const seedSet = new match_1.SongSet(ctx.seeds);
    const add = (ref, strength, seedKey, deezerId, duration) => {
        if (!ref.title || !ref.artist || strength <= 0)
            return;
        if (ctx.played.has(ref) || ctx.skipped.has(ref) || seedSet.has(ref))
            return;
        if (!ctx.allowVariants && (0, match_1.isVariant)(ref.title))
            return;
        if (duration !== null && (duration < MIN_DURATION_S || duration > MAX_DURATION_S))
            return;
        const key = (0, match_1.songKey)(ref);
        const existing = pool.get(key);
        if (existing) {
            existing.score += strength;
            existing.seedHits.add(seedKey);
            existing.deezerId ??= deezerId;
            existing.duration ??= duration;
            return;
        }
        pool.set(key, { title: ref.title, artist: ref.artist, deezerId, duration, score: strength, seedHits: new Set([seedKey]), tags: [] });
    };
    await (0, exports.mapLimit)(ctx.seeds, CONCURRENCY, async (seed) => {
        const seedKey = (0, match_1.songKey)(seed);
        const seedArtist = (0, match_1.primaryArtist)(seed.artist);
        const [similar, radio] = await Promise.all([
            (0, sources_1.lastfmSimilarTracks)(seed).catch((error) => {
                onError(`Last.fm lookup failed for "${seed.title}": ${error}`);
                return [];
            }),
            (0, sources_1.deezerArtistRadio)(seed).catch((error) => {
                onError(`Deezer lookup failed for "${seed.artist}": ${error}`);
                return [];
            }),
        ]);
        for (const track of similar)
            add(track, seed.weight * track.match, seedKey, null, track.duration);
        for (const track of radio)
            add(track, seed.weight * ((0, match_1.primaryArtist)(track.artist) === seedArtist ? DEEZER_SAME_ARTIST_STRENGTH : DEEZER_RELATED_STRENGTH), seedKey, track.deezerId, track.duration);
    });
    return [...pool.values()];
};
exports.gatherCandidates = gatherCandidates;
const moodFactor = (similarity) => (similarity < OFF_MOOD_SIMILARITY ? OFF_MOOD_FACTOR : 0.3 + similarity);
const rankCandidates = async (ctx, candidates) => {
    for (const candidate of candidates)
        candidate.score *= 1 + CONSENSUS_BONUS * (candidate.seedHits.size - 1);
    const top = [...candidates].sort((a, b) => b.score - a.score).slice(0, CANDIDATES_TO_RANK);
    await (0, exports.mapLimit)(top, CONCURRENCY, async (candidate) => {
        const tags = await (0, sources_1.lastfmArtistTags)(candidate.artist).catch(() => new Map());
        candidate.tags = [...tags.keys()];
        if (ctx.mood.size)
            candidate.score *= tags.size ? moodFactor((0, sources_1.tagSimilarity)(tags, ctx.mood)) : UNTAGGED_FACTOR;
    });
    for (const candidate of top) {
        const artist = (0, match_1.primaryArtist)(candidate.artist);
        if (ctx.skippedArtists.has(artist))
            candidate.score *= SKIPPED_ARTIST_FACTOR;
        if (ctx.recentArtists.has(artist))
            candidate.score *= RECENT_ARTIST_FACTOR;
    }
    return top.sort((a, b) => b.score - a.score);
};
exports.rankCandidates = rankCandidates;
const choosePicks = (ranked, count) => {
    const available = ranked.slice(0, Math.max(count * 3, count));
    const picks = [];
    const artists = new Set();
    while (picks.length < count && available.length) {
        const fresh = available.filter((candidate) => !artists.has((0, match_1.primaryArtist)(candidate.artist)));
        const from = fresh.length ? fresh : available;
        const total = from.reduce((sum, candidate) => sum + candidate.score ** 2, 0);
        let roll = Math.random() * total;
        let chosen = from[from.length - 1];
        for (const candidate of from) {
            roll -= candidate.score ** 2;
            if (roll <= 0) {
                chosen = candidate;
                break;
            }
        }
        picks.push(chosen);
        artists.add((0, match_1.primaryArtist)(chosen.artist));
        available.splice(available.indexOf(chosen), 1);
    }
    return [...picks, ...ranked.filter((candidate) => !picks.includes(candidate))];
};
exports.choosePicks = choosePicks;
