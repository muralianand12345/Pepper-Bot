"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../../../core/music");
const event = {
    name: discord_js_1.default.Events.ClientReady,
    execute: async (client) => {
        try {
            if (!client.config.music.enabled)
                return client.logger.info('[LAVALINK] Music is disabled, skipping user node initialization');
            client.logger.info('[LAVALINK] Initializing user Lavalink nodes...');
            const lavalink = new music_1.LavaLink(client);
            await lavalink.initializeUserNodes();
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Failed to initialize user nodes: ${error}`);
        }
    },
};
exports.default = event;
