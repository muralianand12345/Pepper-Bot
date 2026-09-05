"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const msg_1 = require("../../../utils/msg");
const webhook_1 = require("../../../utils/webhook");
const shard_1 = require("../../../utils/shard");
const v2_1 = require("../../../utils/v2");
const event = {
    name: discord_js_1.default.Events.GuildDelete,
    execute: async (guild, client) => {
        try {
            const guildName = guild.name || 'Unknown Guild';
            const guildId = guild.id || 'Unknown ID';
            client.logger.info(`[SERVER_LEAVE] Left ${guildName} (${guildId})`);
            await Promise.allSettled([sendLogMessage(guild, client), sendFeedbackRequestDM(guild, client)]);
        }
        catch (error) {
            client.logger.error(`[SERVER_LEAVE] Error handling guild delete event: ${error}`);
        }
    },
};
const sendLogMessage = async (guild, client) => {
    try {
        const logChannelId = client.config?.bot?.log?.server;
        if (!logChannelId)
            return client.logger.warn(`[SERVER_LEAVE] No log channel configured`);
        (0, shard_1.invalidateStatsCache)();
        const totalGuilds = await (0, shard_1.getGlobalGuildCount)(client);
        const details = (0, v2_1.fields)([
            ['Members', guild.memberCount?.toString() || 'Unknown'],
            ['Owner', guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown Owner'],
            ['Created', guild.createdAt ? `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>` : 'Unknown Date'],
        ]);
        const leaveContainer = (0, v2_1.panel)(0xff0000, {
            title: 'Server Left',
            body: `I have left **${guild.name || 'Unknown Guild'}** (${guild.id}).\n\n${details}`,
            thumbnail: guild.iconURL({ size: 256 }),
            footer: `Now in ${totalGuilds.toLocaleString()} servers`,
            timestamp: true,
        });
        await (0, webhook_1.sendChannelWebhook)(client, logChannelId.toString(), { ...(0, v2_1.v2Webhook)(leaveContainer), username: `${client.user?.username || 'Pepper'} Logs`, avatarURL: client.user?.displayAvatarURL() });
        client.logger.debug(`[SERVER_LEAVE] Log message sent successfully`);
    }
    catch (error) {
        client.logger.error(`[SERVER_LEAVE] Failed to send log message: ${error}`);
    }
};
const sendFeedbackRequestDM = async (guild, client) => {
    if (!guild.ownerId)
        return client.logger.warn(`[FEEDBACK] Cannot send feedback DM - no owner ID for guild ${guild.id}`);
    try {
        const owner = await client.users.fetch(guild.ownerId).catch(() => null);
        if (!owner)
            return client.logger.warn(`[FEEDBACK] Cannot send feedback DM - owner not found for guild ${guild.id}`);
        const dmChannel = await owner.createDM().catch(() => null);
        if (!dmChannel)
            return client.logger.warn(`[FEEDBACK] Cannot create DM channel with owner ${guild.ownerId}`);
        const feedbackContainer = (0, v2_1.panel)(0x5865f2, {
            title: 'Your Feedback Matters!',
            body: `Thank you for trying ${client.user?.username || 'Music Bot'}! We noticed the bot is no longer in your server.\n\n` + "We'd love to hear your feedback to improve our service. Your insights are valuable to us!",
            thumbnail: client.user?.displayAvatarURL({ size: 128 }),
            footer: `${client.user?.username || 'Music Bot'}`,
        });
        const actionRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId(`feedback_request_${guild.id}`).setLabel('Share Feedback').setStyle(discord_js_1.default.ButtonStyle.Primary).setEmoji('📝'), new discord_js_1.default.ButtonBuilder()
            .setLabel(`Re-Invite ${client.user?.username || 'Bot'}`)
            .setStyle(discord_js_1.default.ButtonStyle.Link)
            .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`)
            .setEmoji('🎵'), new discord_js_1.default.ButtonBuilder().setLabel('Support Server').setStyle(discord_js_1.default.ButtonStyle.Link).setURL(client.config.bot.support_server.invite).setEmoji('🔧'));
        await (0, msg_1.send)(client, dmChannel.id, (0, v2_1.v2)((0, v2_1.v2Text)(`Hello! This is **${client.user?.username || 'Music Bot'}**, the music bot that was recently removed from **${guild.name || 'your server'}**.`), (0, v2_1.withRows)(feedbackContainer, actionRow)));
        client.logger.info(`[FEEDBACK] Sent feedback request DM to ${owner.tag} (${owner.id}) for guild ${guild.name || guild.id}`);
    }
    catch (error) {
        if (error instanceof discord_js_1.default.DiscordAPIError) {
            switch (error.code) {
                case 10013:
                    client.logger.warn(`[FEEDBACK] User not found for guild ${guild.id} (owner ID: ${guild.ownerId})`);
                    break;
                case 50007:
                    client.logger.warn(`[FEEDBACK] Cannot send DM to ${guild.ownerId} - user has DMs disabled`);
                    break;
                case 50001:
                    client.logger.warn(`[FEEDBACK] Missing access to send DM to ${guild.ownerId}`);
                    break;
                case 40002:
                    client.logger.warn(`[FEEDBACK] Cannot send DM to ${guild.ownerId} - not friends or in mutual server`);
                    break;
                case 50035:
                    client.logger.warn(`[FEEDBACK] Invalid form body when sending DM to ${guild.ownerId}`);
                    break;
                default:
                    client.logger.warn(`[FEEDBACK] Discord API error ${error.code}: ${error.message} when sending DM to ${guild.ownerId}`);
            }
        }
        else {
            client.logger.warn(`[FEEDBACK] Unexpected error sending feedback DM to ${guild.ownerId}: ${error}`);
        }
    }
};
exports.default = event;
