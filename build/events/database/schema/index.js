"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userDataSchema = void 0;
const mongoose_1 = require("mongoose");
exports.userDataSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    avatar: { type: String, required: false },
});
