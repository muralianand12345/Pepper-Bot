"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const discord_js_1 = __importDefault(require("discord.js"));
const commands_1 = require("../core/commands");
const event = {
    name: discord_js_1.default.Events.ClientReady,
    execute: async (client) => {
        try {
            const slashCommandsDir = path_1.default.join(__dirname, '../commands');
            const commandManager = new commands_1.CommandManager(client);
            await commandManager.load(slashCommandsDir);
        }
        catch (error) {
            client.logger.error(`[COMMAND] Failed to load commands: ${error}`);
        }
    },
};
exports.default = event;
