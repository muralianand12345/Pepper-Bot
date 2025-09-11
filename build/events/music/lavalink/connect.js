"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const discord_js_1 = __importDefault(require("discord.js"));
const fs_1 = require("fs");
const loadLavalinkEvents = async (client, eventsPath) => {
    try {
        const eventFiles = (await fs_1.promises.readdir(eventsPath)).filter((file) => file.endsWith('.js') || file.endsWith('.ts'));
        for (const file of eventFiles) {
            try {
                const filePath = path_1.default.join(eventsPath, file);
                const event = require(filePath).default;
                if (!event?.name || typeof event?.execute !== 'function') {
                    client.logger.warn(`[LAVALINK_EVENT] Invalid event file structure: ${file}`);
                    continue;
                }
                client.manager.on(event.name, (...args) => event.execute(...args, client));
                client.logger.debug(`[LAVALINK_EVENT] Loaded event: ${event.name}`);
            }
            catch (error) {
                client.logger.error(`[LAVALINK_EVENT] Failed to load event ${file}: ${error instanceof Error ? error.message : String(error)}`);
                throw error;
            }
        }
    }
    catch (error) {
        client.logger.error(`[LAVALINK_EVENT] Failed to read events directory: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
};
const event = {
    name: discord_js_1.default.Events.ClientReady,
    execute: async (client) => {
        try {
            if (!client.user)
                throw new Error('[LAVALINK] Client user is not defined');
            if (!client.config.music.enabled)
                return client.logger.info('[LAVALINK] Music functionality is disabled');
            client.manager.init({ clientId: client.user.id });
            await loadLavalinkEvents(client, path_1.default.join(__dirname, 'lavalink_events'));
            client.logger.info('[LAVALINK] Successfully initialized and loaded all events');
        }
        catch (error) {
            client.logger.error(`[LAVALINK] Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    },
};
exports.default = event;
