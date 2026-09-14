"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const music_playlist_1 = require("./music_playlist");
const playlistPendingSchema = new mongoose_1.Schema({
    token: { type: String, required: true },
    userId: { type: String, required: true },
    code: { type: String, required: true },
    tracks: { type: [music_playlist_1.playlistTrackSchema], default: [] },
    expiresAt: { type: Date, required: true },
});
playlistPendingSchema.index({ token: 1 }, { unique: true });
playlistPendingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.default = (0, mongoose_1.model)('music-playlist-pendings', playlistPendingSchema);
