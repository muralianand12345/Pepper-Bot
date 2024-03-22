import { Events } from 'discord.js';

import { BotEvent } from '../../../types';
import botAnalysisModal from '../../database/schema/botDataAnalysis';

const event: BotEvent = {
    name: Events.GuildDelete,
    execute: async (guild, client) => {
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
}

export default event;