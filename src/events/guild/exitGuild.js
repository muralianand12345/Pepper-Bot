const {
    Events
} = require('discord.js');

module.exports = {
    name: Events.GuildDelete,
    run: async (client, guild) => {
        client.logger.debug(`[GUILD] Kicked from guild ${guild.name} (${guild.id})`);
    }
};