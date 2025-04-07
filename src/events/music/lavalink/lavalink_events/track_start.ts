import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { musicEmbed, musicButton, MusicChannelManager } from "../../../../utils/music/embed_template";
import MusicDB from "../../../../utils/music/music_db";
import music_guild from "../../../database/schema/music_guild";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { shouldSendMessageInChannel } from "../../../../utils/music_channel_utility";
import { wait } from "../../../../utils/music/music_functions";
import { LavalinkEvent, ISongsUser } from "../../../../types";

const YTREGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;

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

        const channel = (await client.channels.fetch(
            player.textChannelId
        )) as discord.TextChannel;
        if (!channel?.isTextBased()) return;

        // Check if the track is a YouTube URL, if so, skip the event
        if (YTREGEX.test(track.uri)) {
            player.stop(1);

            client.logger.warn(`[LAVALINK] Skipping track start event for YouTube URL: ${track.uri}`);

            const embed = new discord.EmbedBuilder()
                .setColor("Red")
                .setDescription(`⚠️ Skipping song! Youtube source detected.`)
                .setFooter({
                    text: "We do not support Youtube links due to YouTube's TOS.",
                    iconURL: client.user?.displayAvatarURL() || "",
                });

            return await channel.send({
                embeds: [embed]
            }).then((msg) => {
                wait(5000).then(() => {
                    msg.delete().catch((err) => {
                        client.logger.error(`[LAVALINK] Failed to delete message: ${err}`);
                    });
                });
            })
        }

        try {
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

            const guild_data = await music_guild.findOne({
                guildId: player.guildId,
            });

            if (guild_data?.songChannelId && guild_data?.musicPannelId) {
                try {
                    const musicChannel = await client.channels.fetch(
                        guild_data.songChannelId
                    ) as discord.TextChannel;

                    if (musicChannel) {
                        const musicChannelManager = new MusicChannelManager(client);
                        const message_pannel = await musicChannelManager.updateQueueEmbed(
                            guild_data.musicPannelId,
                            musicChannel,
                            player,
                        );

                        // Add debug logging
                        if (message_pannel) {
                            client.logger.info(`[TRACK_START] Successfully updated music panel in ${musicChannel.name}`);
                        } else {
                            client.logger.warn(`[TRACK_START] Failed to update music panel in ${musicChannel.name}`);
                        }
                    }
                } catch (error) {
                    // Log the full error for debugging
                    client.logger.error(`[TRACK_START] Error updating music channel: ${error}`);
                }
            }

            // Only send the now playing message if not repeating AND not in the music channel
            if (shouldDisplayEmbed) {
                // Check if we should send messages in this channel
                const shouldSendMessage = await shouldSendMessageInChannel(
                    channel.id,
                    player.guildId,
                    client
                );

                if (shouldSendMessage) {
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
                } else {
                    client.logger.debug(`[TRACK_START] Skipping Now Playing message in music channel ${channel.id}`);
                }
            }

            logTrackStart(track, player, client);
        } catch (error) {
            client.logger?.error(`Error in trackStart event: ${error}`);
        }
    },
};

export default lavalinkEvent;