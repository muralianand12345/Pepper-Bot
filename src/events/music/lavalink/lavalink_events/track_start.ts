import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { musicEmbed, musicButton } from "../../../../utils/music/embed_template";
import MusicDB from "../../../../utils/music/music_db";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { LavalinkEvent, ISongsUser } from "../../../../types";

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

    if (!requester) {
        client.logger.info(
            `[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId})`
        );
        return;
    }

    client.logger.info(
        `[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) ` +
        `By ${requester.tag} (${requester.id})`
    );
    client.logger.info(
        `[LAVALINK] User: ${requester.tag} (${requester.id}) requested song uri ${track.uri} ` +
        `in ${guildName} (${player.guildId}) using Node ${player.node.options.identifier
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
            if (!channel?.isTextBased()) return;

            // Skip displaying the embed if track is repeating, but still log data
            const shouldDisplayEmbed = !player.trackRepeat;

            const requesterData = track.requester
                ? convertUserToUserData(track.requester as discord.User)
                : null;

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

            // Save song data for analytics regardless of repeat status
            await MusicDB.addMusicUserData(
                track.requester?.id || null,
                songData
            );
            await MusicDB.addMusicGuildData(player.guildId, songData);

            // Only send the now playing message if not repeating
            if (shouldDisplayEmbed) {
                // Get the now playing manager for this guild
                const nowPlayingManager = NowPlayingManager.getInstance(
                    player.guildId,
                    player,
                    client
                );

                // Create initial embed
                const embed = await musicEmbed(client, track, player);

                // Send a new message
                try {
                    const message = await channel.send({
                        embeds: [embed],
                        components: [musicButton]
                    });

                    // Register the message with the now playing manager
                    nowPlayingManager.setMessage(message, false);
                } catch (error: Error | any) {
                    if (error.code === 50007) {
                        client.logger.error(
                            `[LAVALINK] Missing permissions to send messages in ${channel.name} (${channel.id})`
                        );
                        return;
                    }
                    client.logger.error(
                        `[LAVALINK] Error sending message in ${channel.name} (${channel.id}): ${error}`
                    );
                    return;
                }
            }

            logTrackStart(track, player, client);
        } catch (error) {
            client.logger?.error(`Error in trackStart event: ${error}`);
        }
    },
};

export default lavalinkEvent;