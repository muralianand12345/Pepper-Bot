const { Events } = require('discord.js');

module.exports = {
    name: Events.ShardReady,
    execute: async (shardID, unavailableGuilds, client) => {
        client.logger.info(`Shard ${shardID} is ready!`);
    }
};