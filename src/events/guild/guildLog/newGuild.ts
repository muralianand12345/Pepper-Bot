import { Events } from 'discord.js';

import { BotEvent } from '../../../types';
import botAnalysisModal from '../../database/schema/botDataAnalysis';

const event: BotEvent = {
    name: Events.GuildCreate,
    execute: async (guild, client) => {
        var botAnalysisData = await botAnalysisModal.findOne({
            clientId: client.user.id
        });
        if (botAnalysisData) {
            botAnalysisData.server.push({
                serverId: guild.id || 'Unknown Server ID',
                serverName: guild.name || 'Unknown Server Name',
                serverOwner: guild.ownerId || 'Unknown Owner ID',
                serverMemberCount: guild.memberCount || 0,
                timeOfJoin: guild.joinedAt || new Date(),
                active: true
            });
            await botAnalysisData.save();
        }
        client.logger.debug(`[GUILD] Joined guild ${guild.name} (${guild.id})`);
    }
}

export default event;