"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = require("magmastream");
const locales_1 = require("../../../../core/locales");
const music_1 = require("../../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const createQueueEndEmbed = (client, locale = 'en') => {
    const responseHandler = new music_1.MusicResponseHandler(client);
    return responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.queue_empty', locale) || '🎵 Played all music in queue', locale);
};
const shouldAutoplayKeepAlive = (player, guildId, client) => {
    try {
        const autoplayManager = music_1.Autoplay.getInstance(guildId, player, client);
        return autoplayManager.isEnabled();
    }
    catch (error) {
        client.logger.error(`[QUEUE_END] Error checking autoplay status: ${error}`);
        return false;
    }
};
const validateChannelAccess = async (client, channelId) => {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            client.logger.warn(`[QUEUE_END] Channel ${channelId} not found`);
            return null;
        }
        if (!channel.isTextBased()) {
            client.logger.warn(`[QUEUE_END] Channel ${channelId} is not text-based`);
            return null;
        }
        const textChannel = channel;
        const guild = textChannel.guild;
        const botMember = guild.members.me;
        if (!botMember) {
            client.logger.warn(`[QUEUE_END] Bot member not found in guild ${guild.id}`);
            return null;
        }
        const permissions = textChannel.permissionsFor(botMember);
        if (!permissions || !permissions.has([discord_js_1.default.PermissionsBitField.Flags.ViewChannel, discord_js_1.default.PermissionsBitField.Flags.SendMessages])) {
            client.logger.warn(`[QUEUE_END] Missing permissions for channel ${channelId} in guild ${guild.id}`);
            return null;
        }
        return textChannel;
    }
    catch (error) {
        if (error instanceof discord_js_1.default.DiscordAPIError) {
            switch (error.code) {
                case 10003:
                    client.logger.warn(`[QUEUE_END] Channel ${channelId} not found (deleted)`);
                    break;
                case 50001:
                    client.logger.warn(`[QUEUE_END] Missing access to channel ${channelId}`);
                    break;
                case 50013:
                    client.logger.warn(`[QUEUE_END] Missing permissions for channel ${channelId}`);
                    break;
                default:
                    client.logger.warn(`[QUEUE_END] Discord API error ${error.code} for channel ${channelId}: ${error.message}`);
            }
        }
        else {
            client.logger.error(`[QUEUE_END] Error validating channel access: ${error}`);
        }
        return null;
    }
};
const sendQueueEndMessage = async (client, channel, locale) => {
    try {
        const queueEndEmbed = createQueueEndEmbed(client, locale);
        await channel.send({ embeds: [queueEndEmbed] });
        client.logger.debug(`[QUEUE_END] Queue end message sent for guild ${channel.guild.id}`);
    }
    catch (error) {
        if (error instanceof discord_js_1.default.DiscordAPIError) {
            switch (error.code) {
                case 50001:
                    client.logger.warn(`[QUEUE_END] Missing access to send message in channel ${channel.id}`);
                    break;
                case 50013:
                    client.logger.warn(`[QUEUE_END] Missing permissions to send message in channel ${channel.id}`);
                    break;
                case 10003:
                    client.logger.warn(`[QUEUE_END] Channel ${channel.id} was deleted while trying to send message`);
                    break;
                default:
                    client.logger.error(`[QUEUE_END] Discord API error ${error.code} sending message: ${error.message}`);
            }
        }
        else {
            client.logger.error(`[QUEUE_END] Error sending queue end message: ${error}`);
        }
    }
};
const handlePlayerCleanup = async (player, guildId, client) => {
    if (shouldAutoplayKeepAlive(player, guildId, client)) {
        return client.logger.info(`[QUEUE_END] Autoplay is enabled, keeping player alive for guild ${guildId}`);
    }
    const nowPlayingManager = music_1.NowPlayingManager.getInstance(guildId, player, client);
    nowPlayingManager.onStop();
    const CLEANUP_DELAY = 300000;
    const CLEANUP_DELAY_MINS = CLEANUP_DELAY / 60000;
    const scheduledAt = Date.now();
    player.cleanupScheduledAt = scheduledAt;
    client.logger.info(`[QUEUE_END] Scheduled cleanup for guild ${guildId} in ${CLEANUP_DELAY_MINS} minutes`);
    await (0, music_1.wait)(CLEANUP_DELAY);
    const currentPlayer = client.manager.get(guildId);
    if (!currentPlayer)
        return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} already destroyed, skipping cleanup`);
    if (currentPlayer.cleanupScheduledAt !== scheduledAt)
        return client.logger.debug(`[QUEUE_END] Cleanup task for guild ${guildId} has been superseded, skipping`);
    if (currentPlayer.playing || currentPlayer.queue.current)
        return client.logger.debug(`[QUEUE_END] Player for guild ${guildId} is active again, skipping cleanup`);
    music_1.NowPlayingManager.removeInstance(guildId);
    music_1.Autoplay.removeInstance(guildId);
    client.logger.info(`[QUEUE_END] Performing cleanup for guild ${guildId} after ${CLEANUP_DELAY_MINS} minutes of inactivity`);
    player.destroy();
};
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.QueueEnd,
    execute: async (player, track, payload, client) => {
        if (!player?.textChannelId || !client?.channels)
            return client.logger.warn(`[QUEUE_END] Missing player textChannelId or client channels for guild ${player?.guildId}`);
        try {
            const autoplayManager = music_1.Autoplay.getInstance(player.guildId, player, client);
            if (autoplayManager.isEnabled() && track) {
                const processed = await autoplayManager.processTrack(track);
                if (processed)
                    return client.logger.info(`[QUEUE_END] Autoplay added tracks for guild ${player.guildId}`);
            }
            const channel = await validateChannelAccess(client, player.textChannelId);
            if (!channel) {
                client.logger.warn(`[QUEUE_END] Cannot access text channel ${player.textChannelId} for guild ${player.guildId}, skipping message`);
            }
            else {
                let guildLocale = 'en';
                try {
                    guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
                }
                catch (error) {
                    client.logger.warn(`[QUEUE_END] Error getting guild locale: ${error}`);
                }
                await sendQueueEndMessage(client, channel, guildLocale);
            }
            await handlePlayerCleanup(player, player.guildId, client);
        }
        catch (error) {
            client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
