"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const locales_1 = require("../../../../core/locales");
const music_1 = require("../../../../core/music");
const response_1 = require("../../../../core/music/handlers/response");
const YTREGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const localeDetector = new locales_1.LocaleDetector();
const logTrackStart = (track, player, client) => {
    const guildName = client.guilds.cache.get(player.guildId)?.name;
    const requesterData = track.requester ? (0, music_1.getRequester)(client, track.requester) : null;
    if (!requesterData)
        return client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId})`);
    client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) ` + `By ${requesterData.username} (${requesterData.id})`);
    client.logger.info(`[LAVALINK] User: ${requesterData.username} (${requesterData.id}) requested song uri ${track.uri} ` + `in ${guildName} (${player.guildId}) using Node ${player.node.options.identifier} (${player.node.options.host}:${player.node.options.port || ''})`);
};
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.TrackStart,
    execute: async (player, track, payload, client) => {
        if (!player?.textChannelId || !client?.channels)
            return;
        try {
            const channel = (await client.channels.fetch(player.textChannelId));
            if (!channel?.isTextBased())
                return;
            let guildLocale = 'en';
            try {
                guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
            }
            catch (error) { }
            const requesterData = track.requester ? (0, music_1.getRequester)(client, track.requester) : null;
            if (YTREGEX.test(track.uri)) {
                const isFromPlaylist = player.queue && player.queue.size > 0;
                if (!isFromPlaylist) {
                    player.stop(1);
                    client.logger.warn(`[LAVALINK] Skipping YouTube track: ${track.uri}`);
                    const responseHandler = new response_1.MusicResponseHandler(client);
                    const embed = responseHandler.createWarningEmbed(client.localizationManager?.translate('responses.music.youtube_blocked', guildLocale) || '⚠️ Skipping song! Youtube source detected.', guildLocale).setFooter({ text: client.localizationManager?.translate('responses.music.youtube_footer', guildLocale) || "We do not support Youtube links due to YouTube's TOS.", iconURL: client.user?.displayAvatarURL() || '' });
                    return await channel.send({ embeds: [embed] }).then((msg) => (0, music_1.wait)(5000).then(() => msg.delete().catch((err) => client.logger.error(`[LAVALINK] Failed to delete message: ${err}`))));
                }
                else {
                    client.logger.info(`[LAVALINK] Playing YouTube track from playlist: ${track.title}`);
                }
            }
            const songData = {
                track: track.title,
                artworkUrl: track.artworkUrl || '',
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
            await music_1.MusicDB.addMusicUserData(requesterData?.id || null, songData);
            await music_1.MusicDB.addMusicGuildData(player.guildId, songData);
            logTrackStart(track, player, client);
            try {
                music_1.NowPlayingManager.removeInstance(player.guildId);
                const nowPlayingManager = music_1.NowPlayingManager.getInstance(player.guildId, player, client);
                await nowPlayingManager.updateOrCreateMessage(channel, track);
                client.logger.debug(`[LAVALINK] Now playing message created/updated for ${track.title}`);
            }
            catch (nowPlayingError) {
                client.logger.error(`[LAVALINK] Failed to create/update now playing message: ${nowPlayingError}`);
            }
        }
        catch (error) {
            client.logger.error(`[TRACK_START] Error in trackStart event: ${error}`);
        }
    },
};
exports.default = lavalinkEvent;
