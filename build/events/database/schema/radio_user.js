"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const radio_guild_1 = require("./radio_guild");
const radioUserSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    stations: [radio_guild_1.radioStationSchema],
    total_listen_ms: { type: Number, default: 0, required: true },
    total_sessions: { type: Number, default: 0, required: true },
});
radioUserSchema.index({ userId: 1 });
radioUserSchema.index({ 'stations.played_number': -1 });
radioUserSchema.index({ 'stations.total_duration_ms': -1 });
radioUserSchema.index({ userId: 1, 'stations.stationId': 1 });
exports.default = (0, mongoose_1.model)('radio-users', radioUserSchema);
