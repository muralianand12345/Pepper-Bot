"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const webhook_1 = require("../../../utils/webhook");
const shard_1 = require("../../../utils/shard");
const v2_1 = require("../../../utils/v2");
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
            (0, shard_1.invalidateStatsCache)();
            const totalGuilds = await (0, shard_1.getGlobalGuildCount)(client);
            const details = (0, v2_1.fields)([
                guild.memberCount !== undefined && guild.memberCount !== null ? ['Members', guild.memberCount.toString()] : null,
                guild.ownerId ? ['Owner', `<@${guild.ownerId}>`] : null,
                guild.createdAt ? ['Created', `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>`] : null,
            ]);
            const container = (0, v2_1.panel)(0x00ff00, {
                title: 'New Server Joined',
                body: [`I have joined **${guildName}** (${guildId}).`, details].filter(Boolean).join('\n\n'),
                thumbnail: guild.iconURL({ size: 256 }),
                footer: `Now in ${totalGuilds.toLocaleString()} servers`,
                timestamp: true,
            });
            try {
                const logChannelId = client.config?.bot?.log?.server;
                if (!logChannelId)
                    return client.logger.warn(`[SERVER_JOIN] No log channel configured`);
                await (0, webhook_1.sendChannelWebhook)(client, logChannelId.toString(), { ...(0, v2_1.v2Webhook)(container), username: `${client.user?.username || 'Pepper'} Logs`, avatarURL: client.user?.displayAvatarURL() });
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
