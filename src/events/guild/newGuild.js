const {
    Events
} = require('discord.js');

module.exports = {
    name: Events.GuildCreate,
    run: async (client, guild) => {
        client.logger.debug(`[GUILD] Joined guild ${guild.name} (${guild.id})`);
    }
};