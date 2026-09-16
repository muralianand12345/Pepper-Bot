"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaylistService = exports.PLAYLIST_CONFIG = void 0;
const magmastream_1 = require("magmastream");
const playlist_1 = require("../repo/playlist");
const premium_1 = require("../../commands/premium");
exports.PLAYLIST_CONFIG = {
    PLAY_VALUE_PREFIX: 'pepper-playlist:',
    NAME_MAX_LENGTH: 50,
    PAGE_SIZE: 10,
    SEARCH_RESULTS: 5,
    TRANSFER_TTL_MS: 24 * 60 * 60 * 1000,
    PENDING_TTL_MS: 10 * 60 * 1000,
    PREMIUM_CHECK_TIMEOUT_MS: 1200,
    PREMIUM_TIER_ID: 1,
    DEFAULT_LIMITS: { basic: { playlists: 1, songs: 10 }, premium: { playlists: 5, songs: 50 } },
};
const YOUTUBE_REGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const positiveInt = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback);
class PlaylistService {
}
exports.PlaylistService = PlaylistService;
_a = PlaylistService;
PlaylistService.normalizeCode = (input) => {
    const code = (input ?? '').trim().toUpperCase();
    return playlist_1.PlaylistDB.CODE_PATTERN.test(code) ? code : null;
};
PlaylistService.toPlayValue = (code) => `${exports.PLAYLIST_CONFIG.PLAY_VALUE_PREFIX}${code}`;
PlaylistService.normalizeName = (name) => name.replace(/\s+/g, ' ').trim();
PlaylistService.isValidName = (name) => name.length > 0 && name.length <= exports.PLAYLIST_CONFIG.NAME_MAX_LENGTH;
PlaylistService.canView = (playlist, userId) => playlist.visibility === 'public' || playlist.ownerId === userId;
PlaylistService.getTierLimits = (client, tierId) => {
    const isPremium = tierId > 0;
    const fallback = isPremium ? exports.PLAYLIST_CONFIG.DEFAULT_LIMITS.premium : exports.PLAYLIST_CONFIG.DEFAULT_LIMITS.basic;
    const feature = client.config.premium?.tiers?.find((tier) => tier.id === tierId)?.feature;
    return { isPremium, playlists: positiveInt(feature?.custom_playlists, fallback.playlists), songs: positiveInt(feature?.custom_playlist_songs, fallback.songs) };
};
PlaylistService.getPremiumLimits = (client) => _a.getTierLimits(client, exports.PLAYLIST_CONFIG.PREMIUM_TIER_ID);
PlaylistService.getLimits = async (client, userId) => {
    const { isPremium, tier } = await (0, premium_1.checkUserPremium)(client, userId);
    return _a.getTierLimits(client, isPremium ? tier : 0);
};
PlaylistService.getLimitsWithin = async (client, userId, timeoutMs = exports.PLAYLIST_CONFIG.PREMIUM_CHECK_TIMEOUT_MS) => {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
        return await Promise.race([_a.getLimits(client, userId), timeout]);
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
};
PlaylistService.getLockReason = (trackCount, ownedCount, limits) => {
    if (ownedCount > limits.playlists)
        return 'too_many_playlists';
    if (trackCount > limits.songs)
        return 'too_many_songs';
    return null;
};
PlaylistService.isSummaryLocked = (summary, ownedCount, limits) => _a.getLockReason(summary.trackCount, ownedCount, limits) !== null;
PlaylistService.getLock = async (client, playlist) => {
    const [limits, ownedCount] = await Promise.all([_a.getLimits(client, playlist.ownerId), playlist_1.PlaylistDB.countByOwner(playlist.ownerId)]);
    return { reason: _a.getLockReason(playlist.tracks.length, ownedCount, limits), limits, ownedCount };
};
PlaylistService.findForUser = async (userId, input, withAudio = true) => {
    const code = _a.normalizeCode(input);
    const byCode = code ? await playlist_1.PlaylistDB.findByCode(code, withAudio) : null;
    if (byCode?.ownerId === userId)
        return { playlist: byCode, owned: true };
    const name = _a.normalizeName(input);
    const byName = name ? await playlist_1.PlaylistDB.findByOwnerAndName(userId, name, withAudio) : null;
    if (byName)
        return { playlist: byName, owned: true };
    return { playlist: byCode, owned: false };
};
PlaylistService.fromTrack = (track, addedBy) => {
    if (!track?.track || !track.uri)
        return null;
    return {
        encoded: track.track,
        title: track.title || 'Unknown',
        author: track.author || 'Unknown',
        uri: track.uri,
        identifier: track.identifier || '',
        sourceName: track.sourceName || 'unknown',
        duration: Number(track.duration) || 0,
        isSeekable: Boolean(track.isSeekable),
        isStream: Boolean(track.isStream),
        isrc: track.isrc || '',
        artworkUrl: track.artworkUrl || track.thumbnail || null,
        addedBy,
        addedAt: new Date(),
    };
};
PlaylistService.toTrack = (entry, requesterId) => {
    const info = { identifier: entry.identifier, isSeekable: entry.isSeekable, author: entry.author, length: entry.duration, isrc: entry.isrc, isStream: entry.isStream, title: entry.title, uri: entry.uri, artworkUrl: entry.artworkUrl ?? undefined, sourceName: entry.sourceName };
    return magmastream_1.TrackUtils.build({ encoded: entry.encoded, info, pluginInfo: {} }, requesterId);
};
PlaylistService.toPlaylistData = (playlist, requester) => {
    const tracks = playlist.tracks.map((entry) => _a.toTrack(entry, requester.id));
    const duration = tracks.reduce((total, track) => total + (track.isStream ? 0 : track.duration || 0), 0);
    return { name: playlist.name, requester: { id: requester.id, username: requester.username }, playlistInfo: [], duration, tracks };
};
PlaylistService.isSameTrack = (a, b) => a.uri === b.uri || (Boolean(a.identifier) && a.identifier === b.identifier && a.sourceName.toLowerCase() === b.sourceName.toLowerCase());
PlaylistService.resolvePlayable = async (client, value, userId) => {
    const raw = (value ?? '').trim();
    const explicit = raw.toLowerCase().startsWith(exports.PLAYLIST_CONFIG.PLAY_VALUE_PREFIX);
    const code = _a.normalizeCode(explicit ? raw.slice(exports.PLAYLIST_CONFIG.PLAY_VALUE_PREFIX.length) : raw);
    const playlist = code ? await playlist_1.PlaylistDB.findByCode(code) : null;
    if (!playlist)
        return { status: explicit ? 'not_found' : 'none' };
    if (!_a.canView(playlist, userId))
        return { status: explicit ? 'private' : 'none' };
    if (playlist.tracks.length === 0)
        return { status: 'empty', name: playlist.name };
    const lock = await _a.getLock(client, playlist);
    return lock.reason ? { status: 'locked', name: playlist.name } : { status: 'ok', playlist };
};
PlaylistService.addTrack = async (client, userId, code, entry, allowDuplicate) => {
    const playlist = await playlist_1.PlaylistDB.findByCode(code, false);
    if (!playlist)
        return { status: 'not_found' };
    if (playlist.ownerId !== userId)
        return { status: 'not_owner' };
    const lock = await _a.getLock(client, playlist);
    if (lock.reason)
        return { status: 'locked', playlist, lock };
    if (playlist.tracks.length >= lock.limits.songs)
        return { status: 'full', playlist, limits: lock.limits };
    if (!allowDuplicate && playlist.tracks.some((track) => _a.isSameTrack(track, entry)))
        return { status: 'duplicate', playlist };
    const updated = await playlist_1.PlaylistDB.addTrack(code, userId, { ...entry, addedBy: userId, addedAt: new Date() }, lock.limits.songs);
    if (updated)
        return { status: 'added', playlist: updated, limits: lock.limits };
    const latest = await playlist_1.PlaylistDB.findByCode(code, false);
    if (!latest)
        return { status: 'not_found' };
    if (latest.ownerId !== userId)
        return { status: 'not_owner' };
    return { status: 'full', playlist: latest, limits: lock.limits };
};
PlaylistService.searchTracks = async (client, query, userId) => {
    let search = query.trim();
    if (YOUTUBE_REGEX.test(search)) {
        const youtube = await client.manager.search(search, userId);
        if (magmastream_1.TrackUtils.isErrorOrEmptySearchResult(youtube) || !('tracks' in youtube) || youtube.tracks.length === 0)
            return { status: 'no_results' };
        search = `spsearch:${youtube.tracks[0].title} ${youtube.tracks[0].author}`;
    }
    const result = await client.manager.search(search, userId);
    if (magmastream_1.TrackUtils.isErrorOrEmptySearchResult(result))
        return { status: 'no_results' };
    if (result.loadType !== magmastream_1.LoadTypes.Track && result.loadType !== magmastream_1.LoadTypes.Search)
        return { status: 'collection' };
    const seen = new Set();
    const tracks = result.tracks
        .map((track) => _a.fromTrack(track, userId))
        .filter((entry) => {
        if (!entry || seen.has(entry.uri))
            return false;
        seen.add(entry.uri);
        return true;
    })
        .slice(0, exports.PLAYLIST_CONFIG.SEARCH_RESULTS);
    return tracks.length > 0 ? { status: 'ok', tracks, exact: result.loadType === magmastream_1.LoadTypes.Track } : { status: 'no_results' };
};
