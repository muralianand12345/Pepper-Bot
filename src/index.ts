import { ShardingManager } from "discord.js";
import { config } from "dotenv";
import logger from "./module/logger";

import * as path from 'path';

config();

const botPath = path.join(__dirname, "bot.js");

const manager = new ShardingManager(botPath, { token: process.env.TOKEN });

manager.on('shardCreate', shard => {
    logger.info(`Launched shard ${shard.id}`);
});

manager.spawn()
    .then((shards) => {
        shards.forEach(shard => {
            shard.on('message', (message) => {
                logger.success(`[SHARD ${shard.id}] ${message._eval} => ${message._result}`);
            });
        });
    })
    .catch((error) => {
        logger.error(error);
    });

//https://github.com/MericcaN41/discordjs-v14-template-ts/blob/main/src/events/guildCreate.ts