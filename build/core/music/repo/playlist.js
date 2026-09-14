"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaylistDB = void 0;
const crypto_1 = __importDefault(require("crypto"));
const music_playlist_1 = __importDefault(require("../../../events/database/schema/music_playlist"));
const music_playlist_pending_1 = __importDefault(require("../../../events/database/schema/music_playlist_pending"));
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_ATTEMPTS = 5;
const isDuplicateKey = (error, field) => {
    const mongoError = error;
    return mongoError?.code === 11000 && Boolean(mongoError.keyPattern?.[field]);
};
const nameKeyOf = (name) => name.toLowerCase();
const audioProjection = (withAudio) => (withAudio ? {} : { 'tracks.encoded': 0 });
class PlaylistDB {
}
exports.PlaylistDB = PlaylistDB;
_a = PlaylistDB;
PlaylistDB.CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
PlaylistDB.generateCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[crypto_1.default.randomInt(CODE_ALPHABET.length)]).join('');
PlaylistDB.findByCode = async (code, withAudio = true) => {
    return music_playlist_1.default.findOne({ code }, audioProjection(withAudio)).lean().exec();
};
PlaylistDB.findByOwnerAndName = async (ownerId, name, withAudio = true) => {
    return music_playlist_1.default.findOne({ ownerId, nameKey: nameKeyOf(name) }, audioProjection(withAudio)).lean().exec();
};
PlaylistDB.getSummaries = async (filter) => {
    return music_playlist_1.default.aggregate([{ $match: filter }, { $sort: { createdAt: 1 } }, { $project: { _id: 0, code: 1, ownerId: 1, name: 1, visibility: 1, createdAt: 1, trackCount: { $size: '$tracks' } } }]).exec();
};
PlaylistDB.countByOwner = async (ownerId) => {
    return music_playlist_1.default.countDocuments({ ownerId }).exec();
};
PlaylistDB.nameTaken = async (ownerId, name) => {
    return Boolean(await music_playlist_1.default.exists({ ownerId, nameKey: nameKeyOf(name) }).exec());
};
PlaylistDB.create = async (ownerId, name, visibility) => {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
        try {
            const created = await music_playlist_1.default.create({ code: _a.generateCode(), ownerId, name, nameKey: nameKeyOf(name), visibility, tracks: [], transfer: null });
            return { status: 'ok', playlist: created.toObject() };
        }
        catch (error) {
            if (isDuplicateKey(error, 'nameKey'))
                return { status: 'name_taken' };
            if (!isDuplicateKey(error, 'code'))
                throw error;
        }
    }
    throw new Error(`Failed to generate a unique playlist code after ${CODE_ATTEMPTS} attempts`);
};
PlaylistDB.delete = async (code, ownerId) => {
    const result = await music_playlist_1.default.deleteOne({ code, ownerId }).exec();
    return result.deletedCount > 0;
};
PlaylistDB.rename = async (code, ownerId, name) => {
    try {
        const result = await music_playlist_1.default.updateOne({ code, ownerId }, { $set: { name, nameKey: nameKeyOf(name) }, $inc: { revision: 1 } }).exec();
        return result.matchedCount > 0 ? 'ok' : 'not_found';
    }
    catch (error) {
        if (isDuplicateKey(error, 'nameKey'))
            return 'name_taken';
        throw error;
    }
};
/** Counts a play from `/play`. Tracked for every playlist; only public ones are exposed through the stats API. */
PlaylistDB.recordPlay = async (code) => {
    await music_playlist_1.default.updateOne({ code }, { $inc: { playCount: 1 }, $set: { lastPlayedAt: new Date() } }).exec();
};
PlaylistDB.setVisibility = async (code, ownerId, visibility) => {
    const result = await music_playlist_1.default.updateOne({ code, ownerId }, { $set: { visibility } }).exec();
    return result.matchedCount > 0;
};
/** Appends a track only while the playlist is below `limit`, so concurrent adds from other shards can't overfill it. */
PlaylistDB.addTrack = async (code, ownerId, track, limit) => {
    const lastSlot = `tracks.${Math.max(1, limit) - 1}`;
    return music_playlist_1.default.findOneAndUpdate({ code, ownerId, [lastSlot]: { $exists: false } }, { $push: { tracks: track }, $inc: { revision: 1 } }, { returnDocument: 'after' }).lean().exec();
};
PlaylistDB.findOwned = async (code, ownerId) => {
    return music_playlist_1.default.findOne({ code, ownerId }).lean().exec();
};
/** Rewrites the track list only if nobody changed the playlist since it was read. */
PlaylistDB.replaceTracks = async (playlist, tracks) => {
    return music_playlist_1.default.findOneAndUpdate({ code: playlist.code, ownerId: playlist.ownerId, revision: playlist.revision }, { $set: { tracks }, $inc: { revision: 1 } }, { returnDocument: 'after' }).lean().exec();
};
PlaylistDB.removeTrack = async (code, ownerId, position) => {
    const playlist = await _a.findOwned(code, ownerId);
    if (!playlist)
        return { status: 'not_found' };
    if (position < 1 || position > playlist.tracks.length)
        return { status: 'invalid_position' };
    const tracks = [...playlist.tracks];
    const [track] = tracks.splice(position - 1, 1);
    const updated = await _a.replaceTracks(playlist, tracks);
    return updated ? { status: 'ok', playlist: updated, track } : { status: 'conflict' };
};
PlaylistDB.moveTrack = async (code, ownerId, from, to) => {
    const playlist = await _a.findOwned(code, ownerId);
    if (!playlist)
        return { status: 'not_found' };
    const size = playlist.tracks.length;
    if (from < 1 || from > size || to < 1 || to > size)
        return { status: 'invalid_position' };
    const tracks = [...playlist.tracks];
    const [track] = tracks.splice(from - 1, 1);
    tracks.splice(to - 1, 0, track);
    const updated = await _a.replaceTracks(playlist, tracks);
    return updated ? { status: 'ok', playlist: updated, track } : { status: 'conflict' };
};
PlaylistDB.requestTransfer = async (code, ownerId, toUserId, expiresAt) => {
    const result = await music_playlist_1.default.updateOne({ code, ownerId }, { $set: { transfer: { toUserId, expiresAt } } }).exec();
    return result.matchedCount > 0;
};
PlaylistDB.cancelTransfer = async (code, ownerId, toUserId) => {
    const result = await music_playlist_1.default.updateOne({ code, ownerId, 'transfer.toUserId': toUserId }, { $set: { transfer: null } }).exec();
    return result.matchedCount > 0;
};
PlaylistDB.completeTransfer = async (code, fromOwnerId, toUserId) => {
    try {
        const playlist = await music_playlist_1.default.findOneAndUpdate({ code, ownerId: fromOwnerId, 'transfer.toUserId': toUserId, 'transfer.expiresAt': { $gt: new Date() } }, { $set: { ownerId: toUserId, transfer: null }, $inc: { revision: 1 } }, { returnDocument: 'after' }).lean().exec();
        return playlist ? { status: 'ok', playlist } : { status: 'expired' };
    }
    catch (error) {
        if (isDuplicateKey(error, 'nameKey'))
            return { status: 'name_taken' };
        throw error;
    }
};
PlaylistDB.createPending = async (userId, code, tracks, ttlMs) => {
    const token = crypto_1.default.randomBytes(8).toString('hex');
    await music_playlist_pending_1.default.create({ token, userId, code, tracks, expiresAt: new Date(Date.now() + ttlMs) });
    return token;
};
PlaylistDB.getPending = async (token, userId) => {
    return music_playlist_pending_1.default.findOne({ token, userId, expiresAt: { $gt: new Date() } }).lean().exec();
};
PlaylistDB.deletePending = async (token, userId) => {
    await music_playlist_pending_1.default.deleteOne({ token, userId }).exec();
};
