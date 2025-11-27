"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const userAccountSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, unique: true },
    accounts: [
        {
            type: { type: String, required: true, enum: ['spotify'] },
            token: { access: { type: String, required: true }, refresh: { type: String, required: true } },
            username: { type: String, required: false },
        },
    ],
}, { timestamps: true });
exports.default = mongoose_1.default.model('account-users', userAccountSchema);
