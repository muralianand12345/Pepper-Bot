import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { sendTempMessage } from "../../../../utils/music/music_functions";
import { MusicResponseHandler } from "../../../../utils/music/embed_template";
import MusicDB from "../../../../utils/music/music_db";
import { LavalinkEvent, ISongsUser } from "../../../../types";

/**
 * Creates a track start notification embed
 * @param track - Track that started playing
 * @param client - Discord client instance
 * @returns EmbedBuilder instance
 */
const createTrackStartEmbed = (
    track: magmastream.Track,
    client: discord.Client
): discord.EmbedBuilder => {
    return new MusicResponseHandler(client).createSuccessEmbed(
        `🎵 ${track.title}`
    );
};

/**
 * Handles track start event logging
 * @param track - Track that started playing
 * @param player - Music player instance
 * @param client - Discord client instance
 */
const logTrackStart = (
    track: magmastream.Track,
    player: magmastream.Player,
    client: discord.Client
): void => {
    const guildName = client.guilds.cache.get(player.guildId)?.name;
    const requester = track.requester as discord.User;

    client.logger.info(
        `[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) ` +
            `By ${requester.tag} (${requester.id})`
    );
    client.logger.info(
        `[LAVALINK] User: ${requester.tag} (${requester.id}) requested song uri ${track.uri} ` +
            `in ${guildName} (${player.guildId}) using Node ${
                player.node.options.identifier
            } (${player.node.options.host}:${player.node.options.port || ""})`
    );
};

/**
 * Creates a user data object from a discord user
 */
const convertUserToUserData = (user: discord.User): ISongsUser => ({
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar || undefined,
});

/**
 * Lavalink track start event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.TrackStart,
    execute: async (
        player: magmastream.Player,
        track: magmastream.Track,
        payload: magmastream.TrackStartEvent,
        client: discord.Client
    ) => {
        if (!player?.textChannelId || !client?.channels) return;

        try {
            const channel = (await client.channels.fetch(
                player.textChannelId
            )) as discord.TextChannel;
            if (!channel?.isTextBased() || player.trackRepeat) return;

            const requester = track.requester as discord.User;
            const requesterId = requester?.id;

            if (!requesterId) {
                client.logger.warn(
                    `[TRACK_START] No requester ID for track: ${track.title}`
                );
            }

            const requesterData = requester
                ? convertUserToUserData(requester)
                : null;

            const songData = {
                track: track.title,
                artworkUrl: track.artworkUrl,
                sourceName: track.sourceName,
                title: track.title,
                identifier: track.identifier,
                author: track.author,
                duration: track.duration,
                isrc: track.isrc,
                isSeekable: track.isSeekable,
                isStream: track.isStream,
                uri: track.uri,
                thumbnail: track.thumbnail,
                requester: requesterData,
                played_number: 1,
                timestamp: new Date(),
            };

            if (requesterId) {
                await MusicDB.addMusicUserData(requesterId, songData);
            } else {
                client.logger.warn(
                    `[TRACK_START] No requester ID for track: ${track.title}`
                );
            }

            await MusicDB.addMusicGuildData(player.guildId, songData);

            // Delete track start notification after 5 seconds
            sendTempMessage(
                channel,
                createTrackStartEmbed(track, client),
                track.duration
            );

            logTrackStart(track, player, client);
        } catch (error) {
            client.logger?.error(`Error in trackStart event: ${error}`);
        }
    },
};

export default lavalinkEvent;
