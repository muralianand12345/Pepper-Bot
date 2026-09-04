"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = require("magmastream");
const msg_1 = require("../../../../utils/msg");
const format_1 = __importDefault(require("../../../../utils/format"));
const config_1 = require("../../../../utils/config");
const locales_1 = require("../../../../core/locales");
const music_1 = require("../../../../core/music");
const v2_1 = require("../../../../utils/v2");
const YTREGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const MIRRORED_SOURCES = new Set(['spotify', 'applemusic', 'tidal', 'qobuz', 'yandexmusic', 'vkmusic']);
const MIRROR_PROVIDERS = ['dzisrc:%ISRC%', 'ytsearch:"%ISRC%"', 'dzsearch:%QUERY%', 'ytmsearch:%QUERY%', 'ytsearch:%QUERY%', 'scsearch:%QUERY%'];
const localeDetector = new locales_1.LocaleDetector();
const configManager = config_1.ConfigManager.getInstance();
const resolvePlaybackSource = async (track, player, client) => {
    const metaSource = (track.sourceName || 'unknown').toLowerCase();
    if (!MIRRORED_SOURCES.has(metaSource))
        return metaSource;
    const query = `${track.title ?? ''} ${track.author ?? ''}`.trim();
    for (const provider of MIRROR_PROVIDERS) {
        if (provider.includes('%ISRC%') && !track.isrc)
            continue;
        const identifier = provider.replace('%ISRC%', track.isrc ?? '').replace('%QUERY%', query);
        try {
            const response = await player.node.rest.get(`/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`);
            const resolved = response?.loadType === magmastream_1.LoadTypes.Track ? response.data : response?.loadType === magmastream_1.LoadTypes.Search ? response.data?.[0] : null;
            if (resolved?.info?.sourceName)
                return `${resolved.info.sourceName} via ${identifier.split(':')[0]} (mirrored from ${metaSource})`;
        }
        catch (error) {
            client.logger.debug(`[LAVALINK] Mirror lookup failed for ${identifier}: ${error}`);
        }
    }
    return `${metaSource} (mirror unresolved)`;
};
const logTrackStart = async (track, player, client) => {
    const guildName = client.guilds.cache.get(player.guildId)?.name;
    const requesterData = track.requester ? (0, music_1.getRequester)(client, track.requester) : null;
    const playbackSource = await resolvePlaybackSource(track, player, client);
    if (!requesterData)
        return client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) [source: ${playbackSource}]`);
    client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) ` + `By ${requesterData.username} (${requesterData.id}) [source: ${playbackSource}]`);
    client.logger.info(`[LAVALINK] User: ${requesterData.username} (${requesterData.id}) requested song uri ${track.uri} ` + `in ${guildName} (${player.guildId}) using Node ${player.node.options.identifier} (${player.node.options.host}:${player.node.options.port || ''})`);
};
const webhookLiveSongs = async (client, track, player) => {
    try {
        const webhookUrl = configManager.getLiveSongsWebhook();
        if (!webhookUrl)
            return client.logger.warn('[LAVALINK] Live songs webhook URL not configured.');
        const webhookClient = new discord_js_1.default.WebhookClient({ url: webhookUrl });
        if (!webhookClient)
            return client.logger.error('[LAVALINK] Live songs webhook client not found.');
        const guild = client.guilds.cache.get(player.guildId);
        const duration = track.isStream ? 'LIVE STREAM' : format_1.default.msToTime(track.duration);
        const voiceChannel = guild?.channels.cache.get(player.voiceChannelId || '');
        const voiceMembers = voiceChannel?.members.filter((member) => !member.user.bot).size || 0;
        const voiceStatus = new music_1.VoiceChannelStatus(client);
        await voiceStatus.setPlaying(player, track);
        const trackHeading = track.uri && !track.uri.includes('youtube') ? `**[${track.title || 'Unknown Track'}](${track.uri})**` : `**${track.title || 'Unknown Track'}**`;
        const details = (0, v2_1.fields)([
            ['⏱️ Duration', `\`${duration}\``],
            ['📻 Source', `\`${track.sourceName || 'Unknown'}\``],
            ['🔊 Listening', `${voiceMembers}`],
            ['🌐 Node', `\`${player.node.options.identifier || 'Unknown Node'}\``],
            ['🆔 Track ID', `\`${track.identifier || 'Unknown'}\``],
        ]);
        const container = (0, v2_1.panel)(0xff0000, {
            title: '🎵 Now Playing Live',
            body: `${trackHeading}\nby **${track.author || 'Unknown Artist'}**\n\n${details}`,
            thumbnail: track.artworkUrl || track.thumbnail || null,
            footer: `${client.user?.username || 'Music Bot'} • Live Song Activity`,
            timestamp: true,
        });
        await webhookClient.send({ ...(0, v2_1.v2Webhook)(container), username: `${client.user?.username || 'Music Bot'} Live Songs`, avatarURL: client.user?.displayAvatarURL() });
        client.logger.debug(`[LAVALINK] Live song activity sent for ${track.title} in ${guild?.name}`);
    }
    catch (error) {
        client.logger.error(`[LAVALINK] Failed to send live song webhook: ${error}`);
    }
};
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.TrackStart,
    execute: async (player, track, payload, client) => {
        try {
            if (!player?.guildId || !track)
                return client.logger.warn('[TRACK_START] Missing player or track');
            const channel = client.channels.cache.get(String(player.textChannelId));
            if (!channel)
                return client.logger.warn(`[TRACK_START] Text channel not found for guild ${player.guildId}`);
            let guildLocale = 'en';
            try {
                guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
            }
            catch (error) {
                client.logger.warn(`[TRACK_START] Error getting guild locale: ${error}`);
            }
            const voiceStatus = new music_1.VoiceChannelStatus(client);
            await voiceStatus.setPlaying(player, track);
            const requesterData = track.requester ? (0, music_1.getRequester)(client, track.requester) : null;
            if (YTREGEX.test(track.uri)) {
                const queueSize = await player.queue.size();
                const isFromPlaylist = player.queue && queueSize > 0;
                if (!isFromPlaylist) {
                    player.stop(1);
                    client.logger.warn(`[LAVALINK] Skipping YouTube track: ${track.uri}`);
                    const responseHandler = new music_1.MusicResponseHandler(client);
                    const container = responseHandler.createWarningContainer(client.localizationManager?.translate('responses.music.youtube_blocked', guildLocale) || '⚠️ Skipping song! Youtube source detected.', client.localizationManager?.translate('responses.music.youtube_footer', guildLocale) || "We do not support Youtube links due to YouTube's TOS.");
                    return await (0, msg_1.send)(client, channel.id, (0, v2_1.v2)(container)).then((msg) => (0, music_1.wait)(5000).then(() => msg?.delete().catch((err) => client.logger.error(`[LAVALINK] Failed to delete message: ${err}`))));
                }
                else {
                    client.logger.info(`[LAVALINK] Playing YouTube track from playlist: ${track.title}`);
                }
            }
            const songData = {
                track: track.title,
                artworkUrl: track.artworkUrl || track.thumbnail || 'https://media.istockphoto.com/id/1175435360/vector/music-note-icon-vector-illustration.jpg',
                sourceName: track.sourceName || 'unknown',
                title: track.title || 'Unknown',
                identifier: track.identifier || `unknown_${Date.now()}`,
                author: track.author || 'Unknown',
                duration: track.duration || 0,
                isrc: track.isrc || '',
                isSeekable: track.isSeekable !== undefined ? track.isSeekable : true,
                isStream: track.isStream !== undefined ? track.isStream : false,
                uri: track.uri || '',
                thumbnail: track.thumbnail || null,
                requester: requesterData,
                played_number: 1,
                timestamp: new Date(),
            };
            if (requesterData?.id && !(0, music_1.isBotRequester)(client, requesterData))
                await music_1.MusicDB.addMusicUserData(requesterData.id, songData);
            await music_1.MusicDB.addMusicGuildData(player.guildId, songData);
            await logTrackStart(track, player, client);
            try {
                music_1.NowPlayingManager.removeInstance(player.guildId);
                const nowPlayingManager = music_1.NowPlayingManager.getInstance(player.guildId, player, client);
                await nowPlayingManager.updateOrCreateMessage(channel, track);
                client.logger.debug(`[LAVALINK] Now playing message created/updated for ${track.title}`);
            }
            catch (nowPlayingError) {
                client.logger.error(`[LAVALINK] Failed to create/update now playing message: ${nowPlayingError}`);
            }
            try {
                if (!music_1.ActivityCheckManager.hasInstance(player.guildId)) {
                    music_1.ActivityCheckManager.getInstance(player.guildId, player, client);
                    client.logger.debug(`[LAVALINK] Activity check manager initialized for guild ${player.guildId}`);
                }
            }
            catch (activityError) {
                client.logger.error(`[LAVALINK] Failed to initialize activity check manager: ${activityError}`);
            }
            try {
                await webhookLiveSongs(client, track, player);
            }
            catch (webhookError) {
                client.logger.error(`[LAVALINK] Failed to send live songs webhook: ${webhookError}`);
            }
        }
        catch (error) {
            client.logger.error(`[TRACK_START] Error in trackStart event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
