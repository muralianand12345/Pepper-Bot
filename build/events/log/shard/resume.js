"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const event = {
    name: discord_js_1.default.Events.ShardResume,
    execute: async (shardID, replayedEvents, client) => client.logger.info(`[SHARD] Shard ${shardID} resumed. Replayed ${replayedEvents} events.`),
};
exports.default = event;
