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
const hasRequiredPermissions = (channel, client) => {
    try {
        if (!channel.guild.members.me)
            return false;
        const botPermissions = channel.permissionsFor(client.user);
        if (!botPermissions)
            return false;
        return botPermissions.has([discord_js_1.default.PermissionsBitField.Flags.SendMessages, discord_js_1.default.PermissionsBitField.Flags.EmbedLinks]);
    }
    catch (error) {
        return false;
    }
};
const handlePlayerCleanup = async (player, guildId, client) => {
    if (shouldAutoplayKeepAlive(player, guildId, client))
        return client.logger.info(`[QUEUE_END] Autoplay is enabled, keeping player alive for guild ${guildId}`);
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
            return;
        try {
            const channel = (await client.channels.fetch(player.textChannelId));
            if (!channel?.isTextBased()) {
                client.logger.warn(`[QUEUE_END] Channel ${player.textChannelId} is not accessible or not text-based for guild ${player.guildId}`);
                await handlePlayerCleanup(player, player.guildId, client);
                return;
            }
            const autoplayManager = music_1.Autoplay.getInstance(player.guildId, player, client);
            if (autoplayManager.isEnabled() && track) {
                const processed = await autoplayManager.processTrack(track);
                if (processed)
                    return client.logger.info(`[QUEUE_END] Autoplay added tracks for guild ${player.guildId}`);
            }
            try {
                // Check bot permissions before attempting to send message
                if (!hasRequiredPermissions(channel, client)) {
                    client.logger.warn(`[QUEUE_END] Bot lacks SendMessages or EmbedLinks permission in channel ${channel.id} for guild ${player.guildId}`);
                }
                else {
                    let guildLocale = 'en';
                    try {
                        guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
                    }
                    catch (error) { }
                    const queueEndEmbed = createQueueEndEmbed(client, guildLocale);
                    await channel.send({ embeds: [queueEndEmbed] });
                    client.logger.debug(`[QUEUE_END] Queue end message sent for guild ${player.guildId}`);
                }
            }
            catch (messageError) {
                if (messageError instanceof discord_js_1.default.DiscordAPIError) {
                    switch (messageError.code) {
                        case 50001:
                        case 50013:
                            client.logger.warn(`[QUEUE_END] Missing permissions to send message (${messageError.code}) in guild ${player.guildId}`);
                            break;
                        case 10003:
                        case 10008:
                            client.logger.warn(`[QUEUE_END] Channel or message deleted (${messageError.code}) in guild ${player.guildId}`);
                            break;
                        default:
                            client.logger.error(`[QUEUE_END] Discord API error ${messageError.code} when sending queue end message: ${messageError.message}`);
                    }
                }
                else {
                    client.logger.error(`[QUEUE_END] Failed to send queue end message: ${messageError}`);
                }
            }
            await handlePlayerCleanup(player, player.guildId, client);
        }
        catch (error) {
            client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
