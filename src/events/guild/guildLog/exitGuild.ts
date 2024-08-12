import { Events, EmbedBuilder, Guild, Client } from 'discord.js';
import { BotEvent } from '../../../types';
import botAnalysisModal from '../../database/schema/botDataAnalysis';

const event: BotEvent = {
    name: Events.GuildDelete,
    execute: async (guild: Guild, client: Client) => {
        var botAnalysisData = await botAnalysisModal.findOne({
            clientId: client.user?.id
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
            .addFields(
                { name: 'Members', value: guild.memberCount?.toString() || 'Unknown', inline: true },
                { name: 'Owner', value: guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown Owner', inline: true },
                { name: 'Created', value: guild.createdAt?.toDateString() || 'Unknown Date', inline: true },
            )
            .setThumbnail(guild.iconURL() || null)
            .setFooter({ text: `Guild ID: ${guild.id}` })
            .setColor('Red')
            .setTimestamp();

        const logChannel = client.channels.cache.get("1272460335030468712");
        if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [embed] });
        } else {
            client.logger.error(`Log channel not found or not a text channel`);
        }

        client.logger.debug(`[GUILD] Kicked from guild ${guild.name} (${guild.id})`);
    }
}

export default event;