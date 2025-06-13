"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const mongoose_1 = require("mongoose");
const config_1 = require("../../../utils/config");
const configManager = config_1.ConfigManager.getInstance();
const event = {
    name: discord_js_1.default.Events.ClientReady,
    once: true,
    execute: (client) => {
        const MONGO_URI = configManager.getMongoUri();
        if (!MONGO_URI)
            throw new Error('[DATABASE] MONGO_URI is not defined');
        (0, mongoose_1.set)('strictQuery', false);
        (0, mongoose_1.connect)(MONGO_URI)
            .then(() => {
            client.logger.success('[DATABASE] Connected to MongoDB');
        })
            .catch((error) => {
            client.logger.error(`[DATABASE] Error connecting to MongoDB: ${error}`);
        });
    },
};
exports.default = event;
