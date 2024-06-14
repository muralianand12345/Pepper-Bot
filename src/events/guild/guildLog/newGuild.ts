import { Events, EmbedBuilder } from 'discord.js';

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

        const embed = new EmbedBuilder()
            .setTitle('New Guild')
            .setDescription(`I have joined **${guild.name}** (${guild.id})`)
            .setFields(
                { name: 'Members', value: guild.memberCount.toString(), inline: true },
                { name: 'Owner', value: guild.owner?.user.tag, inline: true },
                { name: 'Region', value: guild.region, inline: true },
                { name: 'Created', value: guild.createdAt.toDateString(), inline: true },
            )
            .setThumbnail(guild.iconURL() || '')
            .setFooter({ text: `Guild ID: ${guild.id}` })
            .setColor('Green')
            .setTimestamp();


        await client.channels.cache.get("1251103097632194620").send({ embeds: [embed] });

        client.logger.debug(`[GUILD] Joined guild ${guild.name} (${guild.id})`);
    }
}

export default event;