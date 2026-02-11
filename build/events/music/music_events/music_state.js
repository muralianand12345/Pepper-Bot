"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const msg_1 = require("../../../utils/msg");
const locales_1 = require("../../../core/locales");
const music_guild_1 = __importDefault(require("../../../events/database/schema/music_guild"));
const music_1 = require("../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const event = {
    name: discord_js_1.default.Events.VoiceStateUpdate,
    execute: async (oldState, newState, client) => {
        if (!client.config.music.enabled)
            return;
        const player = client.manager.getPlayer(newState.guild.id);
        if (!player || player.state !== 'CONNECTED')
            return;
        const currentTrack = await player.queue.getCurrent();
        if (newState.id === client.user?.id && !newState.channelId && oldState.channelId) {
            client.logger.info(`[VOICE_STATE] Bot was disconnected from voice channel in guild ${newState.guild.id}`);
            player.destroy();
            if (currentTrack)
                await new music_1.VoiceChannelStatus(client).clear(player.voiceChannelId || '');
            music_1.NowPlayingManager.removeInstance(player.guildId);
            const textChannel = client.channels.cache.get(String(player.textChannelId));
            if (textChannel?.isTextBased()) {
                let guildLocale = 'en';
                try {
                    guildLocale = (await localeDetector.getGuildLanguage(newState.guild.id)) || 'en';
                }
                catch (error) { }
                const responseHandler = new music_1.MusicResponseHandler(client);
                const embed = responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.disconnected', guildLocale) || '🔌 Music player disconnected');
                await (0, music_1.sendTempMessage)(textChannel, embed, 10000);
            }
            return;
        }
        if (newState.id === client.user?.id && newState.channelId && oldState.channelId && newState.channelId !== oldState.channelId) {
            client.logger.info(`[VOICE_STATE] Bot was moved to different voice channel in guild ${newState.guild.id}`);
            if (player.voiceChannelId !== newState.channelId)
                player.voiceChannelId = newState.channelId;
            return;
        }
        if (!player.voiceChannelId)
            return;
        const playerChannel = client.channels.cache.get(player.voiceChannelId);
        if (!playerChannel)
            return;
        const textChannel = client.channels.cache.get(String(player.textChannelId));
        if (!textChannel)
            return;
        const memberCount = playerChannel.members.filter((member) => !member.user.bot).size;
        let guildLocale = 'en';
        try {
            guildLocale = (await localeDetector.getGuildLanguage(newState.guild.id)) || 'en';
        }
        catch (error) { }
        const nowPlayingManager = music_1.NowPlayingManager.getInstance(player.guildId, player, client);
        if (memberCount === 1 && player.paused) {
            player.pause(false);
            if (currentTrack)
                await new music_1.VoiceChannelStatus(client).setPlaying(player, currentTrack);
            nowPlayingManager.onResume();
            const responseHandler = new music_1.MusicResponseHandler(client);
            const embed = responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.resumed_members_joined', guildLocale) || '▶️ Resumed playback');
            await (0, music_1.sendTempMessage)(textChannel, embed);
        }
        if (memberCount === 0) {
            let isTwentyFourSeven = false;
            try {
                const guild = await music_guild_1.default.findOne({ guildId: newState.guild.id });
                isTwentyFourSeven = guild?.twentyFourSeven ?? false;
            }
            catch (error) {
                client.logger.warn(`[VOICE_STATE] Failed to check 24/7 mode: ${error}`);
            }
            if (isTwentyFourSeven)
                return client.logger.info(`[VOICE_STATE] 24/7 mode enabled for guild ${player.guildId}, staying connected`);
            if (!player.paused && player.playing) {
                player.pause(true);
                if (currentTrack)
                    await new music_1.VoiceChannelStatus(client).setPaused(player, currentTrack);
                nowPlayingManager.onPause();
                const responseHandler = new music_1.MusicResponseHandler(client);
                const embed = responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.paused_empty_channel', guildLocale) || '⏸️ Paused playback because the voice channel is empty');
                await (0, music_1.sendTempMessage)(textChannel, embed);
            }
            const DISCONNECT_DELAY = 300000;
            const scheduledAt = Date.now();
            player.cleanupScheduledAt = scheduledAt;
            client.logger.info(`[VOICE_STATE] Everyone left channel in guild ${player.guildId}, scheduling disconnect in 5 minutes`);
            setTimeout(async () => {
                try {
                    const currentPlayer = client.manager.getPlayer(player.guildId);
                    if (!currentPlayer)
                        return;
                    if (currentPlayer.cleanupScheduledAt !== scheduledAt)
                        return;
                    const currentChannel = client.channels.cache.get(String(currentPlayer.voiceChannelId));
                    if (!currentChannel)
                        return;
                    const currentMemberCount = currentChannel.members.filter((member) => !member.user.bot).size;
                    if (currentMemberCount === 0) {
                        client.logger.info(`[VOICE_STATE] Voice channel still empty after 5 minutes, disconnecting from guild ${player.guildId}`);
                        const nowPlayingManager = music_1.NowPlayingManager.getInstance(player.guildId, currentPlayer, client);
                        await nowPlayingManager.disableButtons();
                        const responseHandler = new music_1.MusicResponseHandler(client);
                        const disconnectEmbed = responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.disconnected_inactivity', guildLocale) || '🔌 Disconnecting due to inactivity (5 minutes with no listeners)');
                        await (0, msg_1.send)(client, textChannel.id, { embeds: [disconnectEmbed] }).catch((err) => client.logger.warn(`[VOICE_STATE] Failed to send disconnect message: ${err}`));
                        music_1.NowPlayingManager.removeInstance(player.guildId);
                        currentPlayer.destroy();
                        if (currentTrack)
                            await new music_1.VoiceChannelStatus(client).clear(currentPlayer.voiceChannelId || '');
                    }
                }
                catch (error) {
                    client.logger.error(`[VOICE_STATE] Error during auto-disconnect: ${error}`);
                }
            }, DISCONNECT_DELAY);
        }
    },
};
exports.default = event;
