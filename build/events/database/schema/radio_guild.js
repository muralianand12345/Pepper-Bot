"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.radioStationSchema = void 0;
const mongoose_1 = require("mongoose");
const index_1 = require("./index");
exports.radioStationSchema = new mongoose_1.Schema({
    stationId: { type: String, required: true },
    name: { type: String, required: true },
    genre: { type: String, required: false, default: 'Radio' },
    country: { type: String, required: false, default: null },
    url: { type: String, required: true },
    artworkUrl: { type: String, required: false, default: null },
    codec: { type: String, required: false, default: 'MP3' },
    bitrate: { type: Number, required: false, default: 0 },
    source: { type: String, enum: ['curated', 'radiobrowser'], required: true },
    played_number: { type: Number, default: 1, required: true },
    total_duration_ms: { type: Number, default: 0, required: true },
    reconnect_count: { type: Number, default: 0, required: true },
    failure_count: { type: Number, default: 0, required: true },
    last_requester: { type: index_1.userDataSchema, required: false },
    first_played: { type: Date, required: true },
    last_played: { type: Date, required: true },
}, { _id: false });
const radioGuildSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true },
    stations: [exports.radioStationSchema],
    total_listen_ms: { type: Number, default: 0, required: true },
    total_sessions: { type: Number, default: 0, required: true },
});
radioGuildSchema.index({ guildId: 1 });
radioGuildSchema.index({ 'stations.played_number': -1 });
radioGuildSchema.index({ 'stations.total_duration_ms': -1 });
radioGuildSchema.index({ 'stations.last_played': -1 });
radioGuildSchema.index({ guildId: 1, 'stations.stationId': 1 });
exports.default = (0, mongoose_1.model)('radio-guilds', radioGuildSchema);
