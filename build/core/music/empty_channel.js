"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEmptyVoiceChannel = exports.countListeners = void 0;
const msg_1 = require("../../utils/msg");
const v2_1 = require("../../utils/v2");
const func_1 = require("./func");
const locales_1 = require("../locales");
const utils_1 = require("./utils");
const stream_refresh_1 = require("./stream_refresh");
const handlers_1 = require("./handlers");
const now_playing_1 = require("./now_playing");
const DISCONNECT_DELAY = 5 * 60 * 1000; // 5 minutes
const localeDetector = new locales_1.LocaleDetector();
const countListeners = (client, voiceChannelId) => {
    const channel = voiceChannelId ? client.channels.cache.get(voiceChannelId) : null;
    if (!channel?.isVoiceBased())
        return null;
    return channel.members.filter((member) => !member.user.bot).size;
};
exports.countListeners = countListeners;
const getGuildLocale = async (guildId) => {
    try {
        return (await localeDetector.getGuildLanguage(guildId)) || 'en';
    }
    catch (error) {
        return 'en';
    }
};
const getTextChannel = (client, player) => {
    const channel = player.textChannelId ? client.channels.cache.get(player.textChannelId) : null;
    return channel?.isTextBased() ? channel : null;
};
const handleEmptyVoiceChannel = async (player, client) => {
    const guildLocale = await getGuildLocale(player.guildId);
    const textChannel = getTextChannel(client, player);
    if (!player.paused && player.playing) {
        const currentTrack = await player.queue.getCurrent();
        await player.pause(true);
        (0, stream_refresh_1.markPaused)(player.guildId);
        if (currentTrack)
            await new utils_1.VoiceChannelStatus(client).setPaused(player, currentTrack);
        now_playing_1.NowPlayingManager.getInstance(player.guildId, player, client).onPause();
        if (textChannel) {
            const responseHandler = new handlers_1.MusicResponseHandler(client);
            const container = responseHandler.createPlayerStateContainer('paused', client.localizationManager?.translate('responses.music.paused_empty_channel', guildLocale) || '⏸️ Paused playback because the voice channel is empty');
            await (0, func_1.sendTempMessage)(textChannel, container);
        }
    }
    const scheduledAt = Date.now();
    player.cleanupScheduledAt = scheduledAt;
    client.logger.info(`[VOICE_STATE] Voice channel empty in guild ${player.guildId}, scheduling disconnect in 5 minutes`);
    setTimeout(async () => {
        try {
            const currentPlayer = client.manager.getPlayer(player.guildId);
            if (!currentPlayer)
                return;
            if (currentPlayer.cleanupScheduledAt !== scheduledAt)
                return;
            const voiceChannelId = currentPlayer.voiceChannelId;
            if (((0, exports.countListeners)(client, voiceChannelId) ?? 0) > 0)
                return;
            client.logger.info(`[VOICE_STATE] Voice channel still empty after 5 minutes, disconnecting from guild ${player.guildId}`);
            const nowPlayingManager = now_playing_1.NowPlayingManager.getInstance(player.guildId, currentPlayer, client);
            await nowPlayingManager.disableButtons();
            const currentTextChannel = getTextChannel(client, currentPlayer);
            if (currentTextChannel) {
                const responseHandler = new handlers_1.MusicResponseHandler(client);
                const disconnectContainer = responseHandler.createPlayerStateContainer('disconnected', client.localizationManager?.translate('responses.music.disconnected_inactivity', guildLocale) || '🔌 Disconnecting due to inactivity (5 minutes with no listeners)');
                await (0, msg_1.send)(client, currentTextChannel.id, (0, v2_1.v2)(disconnectContainer)).catch((err) => client.logger.warn(`[VOICE_STATE] Failed to send disconnect message: ${err}`));
            }
            now_playing_1.NowPlayingManager.removeInstance(player.guildId);
            await currentPlayer.destroy();
            if (voiceChannelId)
                await new utils_1.VoiceChannelStatus(client).clear(voiceChannelId);
        }
        catch (error) {
            client.logger.error(`[VOICE_STATE] Error during auto-disconnect: ${error}`);
        }
    }, DISCONNECT_DELAY);
};
exports.handleEmptyVoiceChannel = handleEmptyVoiceChannel;
