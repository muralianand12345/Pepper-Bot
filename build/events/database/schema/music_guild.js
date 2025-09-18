"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const index_1 = require("./index");
const musicGuildSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true },
    language: { type: String, required: false, default: null },
    dj: { type: String, required: false, default: null, set: (v) => (typeof v === 'string' || v === null || v === undefined ? v : null) },
    songs: [
        {
            track: { type: String, required: true },
            artworkUrl: { type: String, required: true },
            sourceName: { type: String, required: true },
            title: { type: String, required: true },
            identifier: { type: String, required: true },
            author: { type: String, required: true },
            duration: { type: Number, required: true },
            isrc: { type: String, required: false, default: '' },
            isSeekable: { type: Boolean, required: true },
            isStream: { type: Boolean, required: true },
            uri: { type: String, required: true },
            thumbnail: { type: String, required: false },
            requester: { type: index_1.userDataSchema, required: false },
            played_number: { type: Number, default: 1, required: true },
            timestamp: { type: Date, required: true },
        },
    ],
});
musicGuildSchema.pre('validate', (next) => {
    const doc = this;
    if (doc && 'dj' in doc && doc.dj !== null && typeof doc.dj !== 'string')
        doc.dj = null;
    next();
});
musicGuildSchema.index({ guildId: 1 });
musicGuildSchema.index({ 'songs.played_number': -1 });
musicGuildSchema.index({ 'songs.uri': 1 });
musicGuildSchema.index({ 'songs.timestamp': -1 });
musicGuildSchema.index({ 'songs.author': 1 });
musicGuildSchema.index({ 'songs.timestamp': -1, 'songs.played_number': -1 });
musicGuildSchema.index({ guildId: 1, 'songs.uri': 1 });
musicGuildSchema.index({ guildId: 1, 'songs.played_number': -1 });
exports.default = (0, mongoose_1.model)('music-guilds', musicGuildSchema);
