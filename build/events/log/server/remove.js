"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const event = {
    name: discord_js_1.default.Events.GuildDelete,
    execute: async (guild, client) => {
        try {
            client.logger.info(`[SERVER_LEAVE] Left ${guild.name} (${guild.id})`);
            const leaveEmbed = new discord_js_1.default.EmbedBuilder()
                .setTitle('Server Left')
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() || '' })
                .setDescription(`I have left **${guild.name}** (${guild.id}). Now in **${client.guilds.cache.size}** servers.`)
                .addFields({ name: 'Members', value: guild.memberCount?.toString() || 'Unknown', inline: true }, { name: 'Owner', value: guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown Owner', inline: true }, { name: 'Created', value: guild.createdAt?.toDateString() || 'Unknown Date', inline: true })
                .setThumbnail(guild.iconURL() || null)
                .setColor('Red')
                .setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
                .setTimestamp();
            try {
                const logChannel = client.channels.cache.get(client.config.bot.log.server);
                if (logChannel?.isTextBased()) {
                    await logChannel.send({ embeds: [leaveEmbed] });
                }
                else {
                    client.logger.warn(`[SERVER_LEAVE] Log channel not found or not text-based: ${client.config.bot.log.server}`);
                }
            }
            catch (logError) {
                client.logger.error(`[SERVER_LEAVE] Failed to send log message: ${logError}`);
            }
            try {
                await sendFeedbackRequestDM(guild, client);
            }
            catch (feedbackError) {
                client.logger.error(`[SERVER_LEAVE] Failed to send feedback DM: ${feedbackError}`);
            }
        }
        catch (error) {
            client.logger.error(`[SERVER_LEAVE] Error handling guild delete event: ${error}`);
        }
    },
};
const sendFeedbackRequestDM = async (guild, client) => {
    if (!guild.ownerId)
        return client.logger.warn(`[FEEDBACK] Cannot send feedback DM - no owner ID for guild ${guild.id}`);
    try {
        const owner = await client.users.fetch(guild.ownerId);
        if (!owner)
            return client.logger.warn(`[FEEDBACK] Cannot send feedback DM - owner not found for guild ${guild.id}`);
        const feedbackEmbed = new discord_js_1.default.EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Your Feedback Matters!')
            .setThumbnail(client.user?.displayAvatarURL() || null)
            .setDescription(`Thank you for trying ${client.user?.username} Music Bot! We noticed the bot is no longer in your server.\n\n` + "We'd love to hear your feedback to improve our service. Your insights are valuable to us!")
            .setFooter({ text: `${client.user?.username || 'Pepper'} Music Bot`, iconURL: client.user?.displayAvatarURL() || undefined });
        const actionRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId(`feedback_request_${guild.id}`).setLabel('Share Feedback').setStyle(discord_js_1.default.ButtonStyle.Primary).setEmoji('📝'), new discord_js_1.default.ButtonBuilder().setLabel(`Re-Invite ${client.user?.username} Bot`).setStyle(discord_js_1.default.ButtonStyle.Link).setURL(`https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`).setEmoji('🎵'), new discord_js_1.default.ButtonBuilder().setLabel('Support Server').setStyle(discord_js_1.default.ButtonStyle.Link).setURL('https://discord.gg/XzE9hSbsNb').setEmoji('🔧'));
        await owner.send({ content: `Hello! This is **${client.user?.username}**, the music bot that was recently removed from **${guild.name}**.`, embeds: [feedbackEmbed], components: [actionRow] });
        client.logger.info(`[FEEDBACK] Sent feedback request DM to ${owner.tag} (${owner.id}) for guild ${guild.name} (${guild.id})`);
    }
    catch (fetchError) {
        if (fetchError instanceof discord_js_1.default.DiscordAPIError) {
            switch (fetchError.code) {
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
                default:
                    client.logger.error(`[FEEDBACK] Discord API error ${fetchError.code}: ${fetchError.message}`);
            }
        }
        else {
            client.logger.error(`[FEEDBACK] Unexpected error sending feedback DM: ${fetchError}`);
        }
    }
};
exports.default = event;
