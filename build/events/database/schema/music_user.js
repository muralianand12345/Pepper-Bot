"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const index_1 = require("./index");
const musicUserSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    language: { type: String, required: false, default: null },
    totalXP: { type: Number, default: 0, required: true },
    currentLevel: { type: Number, default: 1, required: true },
    lastXPGain: { type: Date, default: Date.now },
    listeningStartTime: { type: Date, default: null },
    dailyXP: { type: Number, default: 0, required: true },
    weeklyXP: { type: Number, default: 0, required: true },
    monthlyXP: { type: Number, default: 0, required: true },
    lastDailyReset: { type: Date, default: Date.now },
    lastWeeklyReset: { type: Date, default: Date.now },
    lastMonthlyReset: { type: Date, default: Date.now },
    xpMultiplier: { type: Number, default: 1.0, required: true },
    streakDays: { type: Number, default: 0, required: true },
    lastActiveDate: { type: Date, default: Date.now },
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
exports.default = (0, mongoose_1.model)('music-users', musicUserSchema);
