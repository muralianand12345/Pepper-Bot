"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.radioUser = void 0;
const mongoose_1 = require("mongoose");
const radioUserSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    favoriteStations: [{ type: String, required: true }],
    lastPlayedStation: { type: String, required: false },
    preferredCountries: [{ type: String, required: true }],
    preferredLanguages: [{ type: String, required: true }],
    recentStations: [{ type: String, required: true }],
}, {
    timestamps: true,
});
exports.radioUser = (0, mongoose_1.model)('radio-users', radioUserSchema);
