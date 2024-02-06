const { Events } = require('discord.js');

module.exports = {
    name: Events.ShardReconnecting,
    execute: async (shardID, client) => {
        client.logger.warn(`Shard ${shardID} is reconnecting...`);
    }
};