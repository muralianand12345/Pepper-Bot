"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyAutoplay = exports.onAutoplayQueueEnd = exports.onAutoplayTrackStart = exports.noteAutoplaySkip = exports.autoplayInsertOffset = exports.disableSmartAutoplay = exports.enableSmartAutoplay = exports.isAutoplayTrack = exports.isSmartAutoplayEnabled = exports.getAutoplayConfig = void 0;
const state_1 = require("../radio/state");
const failure_guard_1 = require("../failure_guard");
const config_1 = require("./config");
const match_1 = require("./match");
const sources_1 = require("./sources");
const seeds_1 = require("./seeds");
const picker_1 = require("./picker");
const resolve_1 = require("./resolve");
const ai_1 = require("../../ai");
const session_1 = require("./session");
var config_2 = require("./config");
Object.defineProperty(exports, "getAutoplayConfig", { enumerable: true, get: function () { return config_2.getAutoplayConfig; } });
var session_2 = require("./session");
Object.defineProperty(exports, "isSmartAutoplayEnabled", { enumerable: true, get: function () { return session_2.isSmartAutoplayEnabled; } });
var seeds_2 = require("./seeds");
Object.defineProperty(exports, "isAutoplayTrack", { enumerable: true, get: function () { return seeds_2.isAutoplayTrack; } });
const MAX_STALLS = 3;
const RESOLVE_ATTEMPTS_PER_SLOT = 3;
const TAGS_FOR_AI = 4;
const SKIPS_FOR_AI = 5;
const inFlight = new Map();
const toRef = (track) => ({ title: track.title, artist: track.author });
const shuffleByPlays = (favorites) => favorites
    .map((favorite) => ({ favorite, key: Math.random() ** (1 / Math.max(1, favorite.plays)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ favorite }) => favorite);
const tagNames = async (artist) => [...(await (0, sources_1.lastfmArtistTags)(artist).catch(() => new Map())).keys()].slice(0, TAGS_FOR_AI);
const withTags = (seeds) => Promise.all(seeds.map(async (seed) => ({ title: seed.title, artist: seed.artist, tags: await tagNames(seed.artist) })));
const chooseWithAI = async (client, player, ctx, ranked, count) => {
    if (count <= 0 || !(0, ai_1.isAutoplayAIEnabled)(client))
        return null;
    const pool = ranked.slice(0, (0, ai_1.getAIConfig)(client).autoplay.candidates);
    const state = (0, session_1.getAutoplayState)(player);
    const [moodSongs, listenerLikes] = await Promise.all([withTags(ctx.seeds.filter((seed) => seed.origin === 'session')), withTags(ctx.seeds.filter((seed) => seed.origin !== 'session'))]);
    const result = await (0, ai_1.pickAutoplaySongs)(client, {
        guildId: player.guildId,
        count,
        previousMood: state?.mood ?? null,
        moodSongs,
        listenerLikes,
        skipped: (state?.skipped ?? []).slice(0, SKIPS_FOR_AI),
        candidates: pool.map((candidate) => ({ title: candidate.title, artist: candidate.artist, tags: candidate.tags.slice(0, TAGS_FOR_AI), seedMatches: candidate.seedHits.size })),
    });
    if (!result)
        return null;
    const chosen = result.picks.map((index) => pool[index]);
    return { ordered: [...chosen, ...(0, picker_1.choosePicks)(ranked.filter((candidate) => !chosen.includes(candidate)), count - chosen.length)], mood: result.mood };
};
const runRefill = async (client, player, reason, force) => {
    const guildId = player.guildId;
    if (!(0, session_1.isSmartAutoplayEnabled)(player) || (0, state_1.isRadioActive)(guildId))
        return 0;
    const config = (0, config_1.getAutoplayConfig)(client);
    if (!force && (await player.queue.size()) >= config.refill_below)
        return 0;
    const startedAt = Date.now();
    const ctx = await (0, seeds_1.buildAutoplayContext)(client, player, config);
    if (!ctx.seeds.length) {
        client.logger.info(`[AUTOPLAY] No songs to base picks on for guild ${guildId} (${reason})`);
        return 0;
    }
    client.logger.debug(`[AUTOPLAY] Seeds for guild ${guildId}: ${ctx.seeds.map((seed) => `${seed.title} — ${seed.artist} (${seed.origin})`).join('; ')}`);
    const candidates = await (0, picker_1.gatherCandidates)(ctx, (message) => client.logger.warn(`[AUTOPLAY] ${message}`));
    const ranked = await (0, picker_1.rankCandidates)(ctx, candidates);
    const tracks = [];
    const batch = new match_1.SongSet();
    const batchArtists = new Set();
    const accept = (track) => {
        const ref = toRef(track);
        if (ctx.played.has(ref) || ctx.skipped.has(ref) || batch.has(ref))
            return false;
        batch.add(ref);
        batchArtists.add((0, match_1.primaryArtist)(track.author));
        return true;
    };
    const newCount = config.batch_size - config.favorites_per_batch;
    const aiChoice = await chooseWithAI(client, player, ctx, ranked, newCount);
    let attempts = 0;
    for (const candidate of aiChoice?.ordered ?? (0, picker_1.choosePicks)(ranked, newCount)) {
        if (tracks.length >= newCount || attempts >= newCount * RESOLVE_ATTEMPTS_PER_SLOT)
            break;
        if (batchArtists.has((0, match_1.primaryArtist)(candidate.artist)))
            continue;
        attempts++;
        const track = await (0, resolve_1.resolveCandidate)(client, player, candidate).catch(() => null);
        if (track && accept(track))
            tracks.push(track);
    }
    const favorites = [];
    attempts = 0;
    for (const favorite of [...shuffleByPlays(ctx.favorites.listeners), ...shuffleByPlays(ctx.favorites.server)]) {
        if (favorites.length >= config.favorites_per_batch || attempts >= config.favorites_per_batch * RESOLVE_ATTEMPTS_PER_SLOT)
            break;
        attempts++;
        const track = await (0, resolve_1.resolveFavorite)(client, favorite).catch(() => null);
        if (track && accept(track))
            favorites.push(track);
    }
    for (const favorite of favorites)
        tracks.splice(1 + Math.floor(Math.random() * tracks.length), 0, favorite);
    if (!tracks.length) {
        client.logger.info(`[AUTOPLAY] Nothing playable found for guild ${guildId} (${reason}, ${candidates.length} candidates)`);
        return 0;
    }
    if (client.manager.getPlayer(guildId) !== player || !(0, session_1.isSmartAutoplayEnabled)(player) || (0, state_1.isRadioActive)(guildId))
        return 0;
    await player.queue.add(tracks);
    (0, session_1.recordAutoplayPicks)(player, tracks.map(toRef), aiChoice?.mood ?? null);
    const mood = [...ctx.mood.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([tag]) => tag);
    client.logger.info(`[AUTOPLAY] Queued ${tracks.length} songs for guild ${guildId} (${reason}) in ${Date.now() - startedAt}ms — seeds: ${ctx.counts.session} session, ${ctx.counts.listeners} listener, ${ctx.counts.server} server; ${candidates.length} candidates; mood: ${mood.join(', ') || 'unknown'}; picked by ${aiChoice ? `AI ("${aiChoice.mood}")` : 'score'}`);
    return tracks.length;
};
const refill = (client, player, reason, force = false) => {
    const existing = inFlight.get(player.guildId);
    if (existing)
        return existing;
    const task = runRefill(client, player, reason, force)
        .catch((error) => {
        client.logger.error(`[AUTOPLAY] Refill failed for guild ${player.guildId} (${reason}): ${error}`);
        return 0;
    })
        .finally(() => inFlight.delete(player.guildId));
    inFlight.set(player.guildId, task);
    return task;
};
const enableSmartAutoplay = (client, player, userId) => {
    if (player.isAutoplay)
        player.setAutoplay(false);
    (0, session_1.setSmartAutoplayEnabled)(player, true, userId);
    void refill(client, player, 'enabled');
};
exports.enableSmartAutoplay = enableSmartAutoplay;
const disableSmartAutoplay = async (player) => {
    if (player.isAutoplay)
        player.setAutoplay(false);
    (0, session_1.setSmartAutoplayEnabled)(player, false, null);
    const tracks = await player.queue.getTracks();
    const kept = (0, seeds_1.presentTracks)(tracks).filter((track) => !track.isAutoplay);
    if (kept.length === tracks.length)
        return;
    await player.queue.clear();
    if (kept.length)
        await player.queue.add(kept);
};
exports.disableSmartAutoplay = disableSmartAutoplay;
const autoplayInsertOffset = async (player) => {
    const index = (await player.queue.getTracks()).findIndex((track) => track?.isAutoplay);
    return index === -1 ? undefined : index;
};
exports.autoplayInsertOffset = autoplayInsertOffset;
const noteAutoplaySkip = async (client, player) => {
    if (!(0, session_1.isSmartAutoplayEnabled)(player))
        return;
    const current = await player.queue.getCurrent();
    if (!current?.isAutoplay)
        return;
    if (player.position >= (0, config_1.getAutoplayConfig)(client).early_skip_seconds * 1000)
        return;
    (0, session_1.recordAutoplaySkip)(player, toRef(current));
    client.logger.debug(`[AUTOPLAY] Early skip of "${current.title}" in guild ${player.guildId}`);
};
exports.noteAutoplaySkip = noteAutoplaySkip;
const onAutoplayTrackStart = (client, player) => {
    if (!(0, session_1.isSmartAutoplayEnabled)(player))
        return;
    (0, session_1.clearAutoplayStalls)(player);
    void refill(client, player, 'track_start');
};
exports.onAutoplayTrackStart = onAutoplayTrackStart;
const onAutoplayQueueEnd = async (client, player) => {
    if (!(0, session_1.isSmartAutoplayEnabled)(player) || (0, state_1.isRadioActive)(player.guildId))
        return false;
    if ((0, session_1.markAutoplayStall)(player) > MAX_STALLS) {
        client.logger.warn(`[AUTOPLAY] Giving up in guild ${player.guildId}: picks keep failing to play`);
        return false;
    }
    for (let attempt = 0; attempt < 2 && !(await player.queue.size()); attempt++)
        await refill(client, player, 'queue_end', true);
    if (!(await player.queue.size()) || client.manager.getPlayer(player.guildId) !== player)
        return false;
    (0, failure_guard_1.clearFailures)(player.guildId);
    if (player.paused)
        await player.pause(false);
    await player.play();
    return true;
};
exports.onAutoplayQueueEnd = onAutoplayQueueEnd;
const migrateLegacyAutoplay = (client, player) => {
    if (!player.isAutoplay)
        return;
    const legacyUser = player.get('Internal_AutoplayUser');
    const userId = typeof legacyUser === 'string' ? legacyUser : (legacyUser?.id ?? null);
    player.setAutoplay(false);
    (0, session_1.setSmartAutoplayEnabled)(player, true, userId);
    client.logger.info(`[AUTOPLAY] Switched restored player in guild ${player.guildId} to smart autoplay`);
};
exports.migrateLegacyAutoplay = migrateLegacyAutoplay;
