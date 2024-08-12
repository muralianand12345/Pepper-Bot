import { EmbedBuilder, Events, Guild } from 'discord.js';

import { BotEvent } from '../../../types';
import botDataAnalysis from '../../database/schema/botDataAnalysis';

const event: BotEvent = {
    name: Events.ClientReady,
    once: true,
    execute: async (client) => {

        var botData = await botDataAnalysis.findOne({ clientId: client.user.id });

        if (!botData) {
            botData = new botDataAnalysis({
                clientId: client.user.id,
                restartCount: 0,
                interactionCount: 0,
                commandCount: 0
            });
        }

        botData.restartCount++;

        await client.guilds.cache.forEach(async (guild: Guild) => {

            let server = botData?.server.find((s) => s.serverId === guild.id);
            if (!server) {
                server = {
                    serverId: guild.id,
                    serverName: guild.name,
                    serverOwner: guild.ownerId,
                    serverMemberCount: guild.memberCount,
                    timeOfJoin: new Date(),
                    active: true
                };
                botData?.server.push(server);
            } else {
                server.serverMemberCount = guild.memberCount;
                server.active = true;
            }
        });

        await botData.save();
        
        const embed = new EmbedBuilder()
            .setColor('Orange')
            .setTitle(`Bot Restart Completed and Online ❤️`)
            .setTimestamp();

        client.logger.success(`"${client.user.tag}" is Online!`);

        const logchan = client.channels.cache.get(client.config.bot.stdchan);
        client.channels.cache.get(logchan)?.send({ embeds: [embed] });
    }
}

export default event;