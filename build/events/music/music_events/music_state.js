"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const locales_1 = require("../../../core/locales");
const music_1 = require("../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const event = {
    name: discord_js_1.default.Events.VoiceStateUpdate,
    execute: async (oldState, newState, client) => {
        if (!client.config.music.enabled)
            return;
        const player = client.manager.getPlayer(newState.guild.id);
        if (!player || player.state !== 'CONNECTED' || !player.voiceChannelId)
            return;
        if (newState.id === client.user?.id) {
            if (!newState.channelId || !oldState.channelId || newState.channelId === oldState.channelId)
                return;
            client.logger.info(`[VOICE_STATE] Bot was moved to different voice channel in guild ${newState.guild.id}`);
            if (player.voiceChannelId !== newState.channelId)
                player.voiceChannelId = newState.channelId;
            if ((0, music_1.countListeners)(client, newState.channelId) === 0)
                await (0, music_1.handleEmptyVoiceChannel)(player, client);
            return;
        }
        if ((newState.member ?? oldState.member)?.user.bot)
            return;
        const channelId = player.voiceChannelId;
        const joined = newState.channelId === channelId && oldState.channelId !== channelId;
        const left = oldState.channelId === channelId && newState.channelId !== channelId;
        if (!joined && !left)
            return;
        const memberCount = (0, music_1.countListeners)(client, channelId);
        if (memberCount === null)
            return;
        if (left && memberCount === 0)
            return (0, music_1.handleEmptyVoiceChannel)(player, client);
        if (joined && memberCount === 1 && player.paused) {
            const currentTrack = await player.queue.getCurrent();
            const streamWentStale = (0, music_1.isStreamStale)(player.guildId);
            await player.pause(false);
            (0, music_1.clearPaused)(player.guildId);
            if (streamWentStale)
                await (0, music_1.refreshStream)(player, client, 'resumed when a listener rejoined');
            if (currentTrack)
                await new music_1.VoiceChannelStatus(client).setPlaying(player, currentTrack);
            music_1.NowPlayingManager.getInstance(player.guildId, player, client).onResume();
            const textChannel = client.channels.cache.get(String(player.textChannelId));
            if (!textChannel)
                return;
            let guildLocale = 'en';
            try {
                guildLocale = (await localeDetector.getGuildLanguage(newState.guild.id)) || 'en';
            }
            catch (error) { }
            const responseHandler = new music_1.MusicResponseHandler(client);
            const container = responseHandler.createPlayerStateContainer('playing', client.localizationManager?.translate('responses.music.resumed_members_joined', guildLocale) || '▶️ Resumed playback');
            await (0, music_1.sendTempMessage)(textChannel, container);
        }
    },
};
exports.default = event;
