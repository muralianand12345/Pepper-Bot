"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const userBanSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    reason: { type: String, required: true },
    bannedBy: { type: String, required: false, default: null },
    expiresAt: { type: Date, required: false, default: null },
}, { timestamps: true });
exports.default = (0, mongoose_1.model)('user-bans', userBanSchema);
