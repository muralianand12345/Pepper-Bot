"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playlistTrackSchema = void 0;
const mongoose_1 = require("mongoose");
exports.playlistTrackSchema = new mongoose_1.Schema({
    encoded: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, required: false, default: 'Unknown' },
    uri: { type: String, required: true },
    identifier: { type: String, required: false, default: '' },
    sourceName: { type: String, required: false, default: 'unknown' },
    duration: { type: Number, required: true, default: 0 },
    isSeekable: { type: Boolean, required: true, default: false },
    isStream: { type: Boolean, required: true, default: false },
    isrc: { type: String, required: false, default: '' },
    artworkUrl: { type: String, required: false, default: null },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, required: true },
}, { _id: false });
const playlistTransferSchema = new mongoose_1.Schema({
    toUserId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { _id: false });
const musicPlaylistSchema = new mongoose_1.Schema({
    code: { type: String, required: true },
    ownerId: { type: String, required: true },
    name: { type: String, required: true },
    nameKey: { type: String, required: true },
    visibility: { type: String, required: true, enum: ['private', 'public'], default: 'private' },
    tracks: { type: [exports.playlistTrackSchema], default: [] },
    transfer: { type: playlistTransferSchema, required: false, default: null },
    revision: { type: Number, required: true, default: 0 },
    playCount: { type: Number, required: true, default: 0 },
    lastPlayedAt: { type: Date, required: false, default: null },
}, { timestamps: true });
musicPlaylistSchema.index({ code: 1 }, { unique: true });
musicPlaylistSchema.index({ ownerId: 1, nameKey: 1 }, { unique: true });
musicPlaylistSchema.index({ ownerId: 1, createdAt: 1 });
musicPlaylistSchema.index({ visibility: 1, playCount: -1 });
exports.default = (0, mongoose_1.model)('music-playlists', musicPlaylistSchema);
