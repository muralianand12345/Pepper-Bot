import path from "path";
import discord from "discord.js";

import Logger from "./utils/logger";
import { ConfigManager } from "./utils/config";


const botPath = path.join(__dirname, "main.js");
const configManager = ConfigManager.getInstance();
const logger = new Logger();
const manager = new discord.ShardingManager(botPath, { token: configManager.getToken() });

manager.on("shardCreate", (shard: discord.Shard) => logger.info(`[INDEX] Launched shard ${shard.id}`));

manager
    .spawn()
    .then((shards: discord.Collection<number, discord.Shard>) => {
        shards.forEach((shard: discord.Shard) => shard.on(discord.ShardEvents.Message, (message) => logger.success(`[INDEX] (SHARD ${shard.id}) ${message._eval} => ${message._result}`)));
    })
    .catch((error: Error) => logger.error(error));
