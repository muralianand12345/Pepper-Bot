import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { musicEmbed, musicButton } from "../../../../utils/music/embed_template";
import MusicDB from "../../../../utils/music/music_db";
import music_guild from "../../../../events/database/schema/music_guild";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import MusicPanelManager from "../../../../utils/music/panel_manager";
import { sendTempMessageContent } from "../../../../utils/music/music_functions";
import { LavalinkEvent, ISongsUser } from "../../../../types";

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

const convertUserToUserData = (user: discord.User | null): ISongsUser | null => {
    if (!user) return null;

    return {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar || undefined,
    };
};

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

            const guildData = await music_guild.findOne({ guildId: player.guildId });
            const isSongChannel = guildData?.songChannelId === channel.id;

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

            // Update the music panel with current track
            const panelManager = MusicPanelManager.getInstance(player.guildId, client);
            await panelManager.updateWithCurrentTrack(track, player);

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
                    if (isSongChannel) {
                        await sendTempMessageContent(
                            channel,
                            { embeds: [embed], components: [musicButton] },
                            5000 // 5 seconds
                        );
                    } else {
                        // Regular channel - permanent message
                        const message = await channel.send({
                            embeds: [embed],
                            components: [musicButton]
                        });

                        // Register the message with the now playing manager
                        nowPlayingManager.setMessage(message, false);
                    }
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