const { Events } = require('discord.js');
require("dotenv").config();

module.exports = {
    name: Events.ShardDisconnect,
    execute: async (event, shardID, client) => {
        client.logger.error(`Shard ${shardID} disconnected with code ${event.code}, reason: ${event.reason}`);
        setTimeout(() => {
            client.logger.error('Reconnecting...');
            client.login(process.env.TOKEN);
        }, 1000);
    }
};