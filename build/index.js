"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const discord_js_1 = __importDefault(require("discord.js"));
const logger_1 = require("./utils/logger");
const config_1 = require("./utils/config");
const botPath = path_1.default.join(__dirname, 'main.js');
const configManager = config_1.ConfigManager.getInstance();
const logger = new logger_1.Logger();
const manager = new discord_js_1.default.ShardingManager(botPath, { token: configManager.getToken() });
manager.on('shardCreate', (shard) => logger.info(`[INDEX] Launched shard ${shard.id}`));
manager
    .spawn()
    .then((shards) => shards.forEach((shard) => shard.on(discord_js_1.default.ShardEvents.Message, (message) => logger.success(`[INDEX] (SHARD ${shard.id}) ${message._eval} => ${message._result}`))))
    .catch((error) => logger.error(error));
