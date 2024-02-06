const { Events } = require('discord.js');

module.exports = {
    name: Events.ShardResume,
    execute: async (id, replayedEvents, client) => {
        client.logger.info(`Shard ${id} has resumed, replayed ${replayedEvents} events.`);
    }
};