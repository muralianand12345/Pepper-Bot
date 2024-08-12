import { Events, EmbedBuilder, Guild, Client } from 'discord.js';
import { BotEvent } from '../../../types';
import botAnalysisModal from '../../database/schema/botDataAnalysis';

const event: BotEvent = {
    name: Events.GuildCreate,
    execute: async (guild: Guild, client: Client) => {
        var botAnalysisData = await botAnalysisModal.findOne({
            clientId: client.user?.id
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
            .addFields(
                { name: 'Members', value: guild.memberCount?.toString() || 'Unknown', inline: true },
                { name: 'Owner', value: guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown Owner', inline: true },
                { name: 'Created', value: guild.createdAt?.toDateString() || 'Unknown Date', inline: true },
            )
            .setThumbnail(guild.iconURL() || null)
            .setFooter({ text: `Guild ID: ${guild.id}` })
            .setColor('Green')
            .setTimestamp();

        const logChannel = client.channels.cache.get("1272460335030468712");
        if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [embed] });
        } else {
            client.logger.error(`Log channel not found or not a text channel`);
        }

        client.logger.debug(`[GUILD] Joined guild ${guild.name} (${guild.id})`);
    }
}

export default event;