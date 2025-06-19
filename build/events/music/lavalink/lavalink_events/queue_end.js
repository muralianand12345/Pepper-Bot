"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
            if (!channel?.isTextBased())
                return;
            const autoplayManager = music_1.Autoplay.getInstance(player.guildId, player, client);
            if (autoplayManager.isEnabled() && track) {
                const processed = await autoplayManager.processTrack(track);
                if (processed)
                    return client.logger.info(`[QUEUE_END] Autoplay added tracks for guild ${player.guildId}`);
            }
            try {
                let guildLocale = 'en';
                try {
                    guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
                }
                catch (error) { }
                const queueEndEmbed = createQueueEndEmbed(client, guildLocale);
                await channel.send({ embeds: [queueEndEmbed] });
                client.logger.debug(`[QUEUE_END] Queue end message sent for guild ${player.guildId}`);
            }
            catch (messageError) {
                client.logger.error(`[QUEUE_END] Failed to send queue end message: ${messageError}`);
            }
            await handlePlayerCleanup(player, player.guildId, client);
        }
        catch (error) {
            client.logger.error(`[QUEUE_END] Error in queue end event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
