"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.radioGuild = void 0;
const mongoose_1 = require("mongoose");
const radioGuildSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true },
    allowedLanguages: [{ type: String, required: true }],
    defaultCountry: { type: String, required: false },
    maxBitrate: { type: Number, required: false, default: 320 },
    favoriteStations: [{ type: String, required: true }],
}, {
    timestamps: true,
});
exports.radioGuild = (0, mongoose_1.model)('radio-guilds', radioGuildSchema);
