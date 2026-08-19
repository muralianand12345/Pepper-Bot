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
const manager = new discord_js_1.default.ShardingManager(botPath, { token: configManager.getToken(), totalShards: 'auto', respawn: true });
const attachShardListeners = (shard) => {
    shard.on(discord_js_1.default.ShardEvents.Message, (message) => logger.debug(`[INDEX] (SHARD ${shard.id}) ${message._eval} => ${message._result}`));
    shard.on(discord_js_1.default.ShardEvents.Error, (error) => logger.error(`[INDEX] Shard ${shard.id} errored: ${error.message}`));
    shard.on(discord_js_1.default.ShardEvents.Death, (child) => logger.error(`[INDEX] Shard ${shard.id} died (code ${'exitCode' in child ? (child.exitCode ?? 'unknown') : 'unknown'}), respawning...`));
    shard.on(discord_js_1.default.ShardEvents.Disconnect, () => logger.warn(`[INDEX] Shard ${shard.id} disconnected`));
    shard.on(discord_js_1.default.ShardEvents.Reconnecting, () => logger.warn(`[INDEX] Shard ${shard.id} reconnecting`));
    shard.on(discord_js_1.default.ShardEvents.Ready, () => logger.success(`[INDEX] Shard ${shard.id} ready`));
};
manager.on('shardCreate', (shard) => {
    logger.info(`[INDEX] Launched shard ${shard.id}`);
    attachShardListeners(shard);
});
manager
    .spawn()
    .then((shards) => logger.success(`[INDEX] Spawned ${shards.size} shard(s)`))
    .catch((error) => {
    logger.error(`[INDEX] Failed to spawn shards: ${error}`);
    process.exit(1);
});
