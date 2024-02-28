const {
    Events
} = require('discord.js');

const botAnalysisModal = require("../../database/modals/botDataAnalysis.js")

module.exports = {
    name: Events.GuildDelete,
    run: async (client, guild) => {

        var botAnalysisData = await botAnalysisModal.findOne({
            clientId: client.user.id
        });

        if (botAnalysisData) {
            let server = botAnalysisData.server.find((s) => s.serverId === guild.id);
            if (server) {
                server.active = false;
                await botAnalysisData.save();
            }
        }

        client.logger.debug(`[GUILD] Kicked from guild ${guild.name} (${guild.id})`);
    }
};