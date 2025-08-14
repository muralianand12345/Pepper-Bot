"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const truncateText = (text, maxLength = 100) => {
    if (!text)
        return 'Unknown';
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
};
const event = {
    name: discord_js_1.default.Events.GuildCreate,
    execute: async (guild, client) => {
        try {
            const guildName = truncateText(guild.name || 'Unknown Guild', 50);
            const guildId = guild.id || 'Unknown ID';
            client.logger.info(`[SERVER_JOIN] Joined ${guildName} (${guildId})`);
            const embed = new discord_js_1.default.EmbedBuilder()
                .setTitle('New Server Joined')
                .setDescription(`I have joined **${guildName}** (${guildId}). Now in **${client.guilds.cache.size}** servers.`)
                .setColor('#00ff00')
                .setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
                .setTimestamp();
            if (guild.name)
                embed.setAuthor({ name: truncateText(guild.name, 256), iconURL: guild.iconURL({ size: 128 }) || undefined });
            if (guild.iconURL())
                embed.setThumbnail(guild.iconURL({ size: 256 }));
            const fields = [];
            if (guild.memberCount !== undefined && guild.memberCount !== null)
                fields.push({ name: 'Members', value: guild.memberCount.toString(), inline: true });
            if (guild.ownerId)
                fields.push({ name: 'Owner', value: `<@${guild.ownerId}>`, inline: true });
            if (guild.createdAt)
                fields.push({ name: 'Created', value: `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>`, inline: true });
            if (fields.length > 0)
                embed.addFields(fields);
            try {
                const logChannelId = client.config?.bot?.log?.server;
                if (!logChannelId)
                    return client.logger.warn(`[SERVER_JOIN] No log channel configured`);
                const logChannel = client.channels.cache.get(logChannelId);
                if (!logChannel)
                    return client.logger.warn(`[SERVER_JOIN] Log channel not found: ${logChannelId}`);
                if (!logChannel.isTextBased())
                    return client.logger.warn(`[SERVER_JOIN] Log channel is not text-based: ${logChannelId}`);
                await logChannel.send({ embeds: [embed] });
                client.logger.debug(`[SERVER_JOIN] Log message sent successfully`);
            }
            catch (logError) {
                if (logError instanceof discord_js_1.default.DiscordAPIError) {
                    client.logger.error(`[SERVER_JOIN] Discord API error ${logError.code}: ${logError.message}`);
                }
                else {
                    client.logger.error(`[SERVER_JOIN] Failed to send log message: ${logError}`);
                }
            }
        }
        catch (error) {
            client.logger.error(`[SERVER_JOIN] Error handling guild create event: ${error}`);
        }
    },
};
exports.default = event;
