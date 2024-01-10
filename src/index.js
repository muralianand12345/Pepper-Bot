const { ShardingManager } = require('discord.js');
require("dotenv").config();
const Token = process.env.TOKEN;
const logger = require('./module/logger.js')

const manager = new ShardingManager('./src/bot.js', { token: Token });

manager.on('shardCreate', shard => logger.info(`Launched "shard" ${shard.id}`));

manager.spawn()
    .then(shards => {
        shards.forEach(shard => {
            shard.on('message', message => {
                logger.success(`[SHARD ${shard.id}] ${message._eval} | ${message._result}`);
            });
        });
    })
    .catch((error) => {
        logger.error(error);
    });