import path from "path";
import discord from "discord.js";
import Logger from "./utils/logger";
import { ConfigManager } from "./utils/config";

const botPath = path.join(__dirname, "main.js");
const configManager = ConfigManager.getInstance();
const logger = new Logger();
const manager = new discord.ShardingManager(botPath, {
    token: configManager.getToken(),
});

// Log when a shard is created
manager.on("shardCreate", (shard) => {
    logger.info(`[INDEX] Launched shard ${shard.id}`);
});

// Log when a shard is ready
manager
    .spawn()
    .then((shards) => {
        shards.forEach((shard: discord.Shard) => {
            shard.on(discord.ShardEvents.Message, (message) => {
                logger.success(
                    `[INDEX] (SHARD ${shard.id}) ${message._eval} => ${message._result}`
                );
            });
        });
    })
    .catch((error: Error) => {
        logger.error(error);
    });
