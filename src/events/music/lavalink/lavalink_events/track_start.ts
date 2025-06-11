import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";

import { LocaleDetector } from "../../../../core/locales";
import { LavalinkEvent, ISongsUser } from "../../../../types";
import { wait, MusicDB, NowPlayingManager } from "../../../../core/music";
import { MusicResponseHandler } from "../../../../core/music/handlers/response";


const YTREGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const localeDetector = new LocaleDetector();

const logTrackStart = (track: magmastream.Track, player: magmastream.Player, client: discord.Client): void => {
    const guildName = client.guilds.cache.get(player.guildId)?.name;
    const requester = track.requester as discord.User;
    if (!requester) return client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId})`);

    client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) ` + `By ${requester.tag} (${requester.id})`);
    client.logger.info(`[LAVALINK] User: ${requester.tag} (${requester.id}) requested song uri ${track.uri} ` + `in ${guildName} (${player.guildId}) using Node ${player.node.options.identifier} (${player.node.options.host}:${player.node.options.port || ""})`);
};

const convertUserToUserData = (user: discord.User | null): ISongsUser | null => {
    if (!user) return null;
    return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar || undefined, };
};

const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.TrackStart,
    execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackStartEvent, client: discord.Client) => {
        if (!player?.textChannelId || !client?.channels) return;

        try {
            const channel = (await client.channels.fetch(player.textChannelId)) as discord.TextChannel;
            if (!channel?.isTextBased()) return;

            let guildLocale = 'en';
            try {
                guildLocale = await localeDetector.getGuildLanguage(player.guildId) || 'en';
            } catch (error) { }

            if (YTREGEX.test(track.uri)) {
                const isFromPlaylist = player.queue && player.queue.size > 0;

                if (!isFromPlaylist) {
                    player.stop(1);
                    client.logger.warn(`[LAVALINK] Skipping YouTube track: ${track.uri}`);

                    const responseHandler = new MusicResponseHandler(client);
                    const embed = responseHandler.createWarningEmbed(client.localizationManager?.translate('responses.music.youtube_blocked', guildLocale) || "⚠️ Skipping song! Youtube source detected.", guildLocale).setFooter({ text: client.localizationManager?.translate('responses.music.youtube_footer', guildLocale) || "We do not support Youtube links due to YouTube's TOS.", iconURL: client.user?.displayAvatarURL() || "" });
                    return await channel.send({ embeds: [embed] }).then((msg) => wait(5000).then(() => msg.delete().catch((err) => client.logger.error(`[LAVALINK] Failed to delete message: ${err}`))));
                } else {
                    client.logger.info(`[LAVALINK] Playing YouTube track from playlist: ${track.title}`);
                }
            }

            const requesterData = track.requester ? convertUserToUserData(track.requester as discord.User) : null;

            const songData = {
                track: track.title,
                artworkUrl: track.artworkUrl || "",
                sourceName: track.sourceName || "unknown",
                title: track.title || "Unknown",
                identifier: track.identifier || `unknown_${Date.now()}`,
                author: track.author || "Unknown",
                duration: track.duration || 0,
                isrc: track.isrc || "",
                isSeekable: track.isSeekable !== undefined ? track.isSeekable : true,
                isStream: track.isStream !== undefined ? track.isStream : false,
                uri: track.uri || "",
                thumbnail: track.thumbnail || null,
                requester: requesterData,
                played_number: 1,
                timestamp: new Date(),
            };

            await MusicDB.addMusicUserData(track.requester?.id || null, songData);
            await MusicDB.addMusicGuildData(player.guildId, songData);

            logTrackStart(track, player, client);

            try {
                const nowPlayingManager = NowPlayingManager.getInstance(player.guildId, player, client);
                await nowPlayingManager.updateOrCreateMessage(channel, track);
                client.logger.debug(`[LAVALINK] Now playing message created/updated for ${track.title}`);
            } catch (nowPlayingError) {
                client.logger.error(`[LAVALINK] Failed to create/update now playing message: ${nowPlayingError}`);
            }

        } catch (error) {
            client.logger.error(`[TRACK_START] Error in trackStart event: ${error}`);
        }
    },
};

export default lavalinkEvent;