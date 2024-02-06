const { Events } = require('discord.js');

module.exports = {
    name: Events.ShardError,
    execute: async (error, shardID, client) => {
        client.logger.error(`Shard ${shardID} encountered an error: ${error}`);
    }
};