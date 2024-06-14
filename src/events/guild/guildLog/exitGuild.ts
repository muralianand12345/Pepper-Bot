import { Events, EmbedBuilder } from 'discord.js';

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

        const embed = new EmbedBuilder()
            .setTitle('Left Guild')
            .setDescription(`I have been kicked from **${guild.name}** (${guild.id})`)
            .setFields(
                { name: 'Members', value: guild.memberCount.toString(), inline: true },
                { name: 'Owner', value: guild.owner?.user.tag, inline: true },
                { name: 'Region', value: guild.region, inline: true },
                { name: 'Created', value: guild.createdAt.toDateString(), inline: true },
            )
            .setThumbnail(guild.iconURL() || '')
            .setFooter({ text: `Guild ID: ${guild.id}` })
            .setColor('Red')
            .setTimestamp();

        await client.channels.cache.get("1251103097632194620").send({ embeds: [embed] });

        client.logger.debug(`[GUILD] Kicked from guild ${guild.name} (${guild.id})`);
    }
}

export default event;