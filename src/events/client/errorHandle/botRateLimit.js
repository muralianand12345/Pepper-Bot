const { Events } = require('discord.js');

module.exports = {
    name: Events.RateLimit,
    execute: async (rateLimitData, client) => {
        client.logger.error(`Rate limit hit: ${JSON.stringify(rateLimitData)}`);
    }
}