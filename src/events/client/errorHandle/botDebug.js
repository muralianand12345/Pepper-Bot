const { Events } = require('discord.js');

module.exports = {
    name: Events.Debug,
    execute: async (info, client) => {
        if (!client.config.debug) return;
        client.logger.debug(info);
    }
};