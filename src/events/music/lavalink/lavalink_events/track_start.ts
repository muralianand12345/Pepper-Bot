import discord from "discord.js";
import MusicDB from "../../../../utils/music/music_db";
import magmastream, { ManagerEventTypes } from "magmastream";
import { wait } from "../../../../utils/music/music_functions";
import music_guild from "../../../database/schema/music_guild";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { shouldSendMessageInChannel } from "../../../../utils/music_channel_utility";
import { musicEmbed, musicButton, MusicChannelManager } from "../../../../utils/music/embed_template";
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

        try {
            const channel = (await client.channels.fetch(
                player.textChannelId
            )) as discord.TextChannel;
            if (!channel?.isTextBased()) return;

            if (YTREGEX.test(track.uri)) {
                const isFromPlaylist = player.queue && player.queue.size > 0;

                if (!isFromPlaylist) {
                    player.stop(1);
                    client.logger.warn(`[LAVALINK] Skipping YouTube track: ${track.uri}`);

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
                    });
                } else {
                    client.logger.info(`[LAVALINK] Playing YouTube track from playlist: ${track.title}`);
                }
            }

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
                        try {
                            const message_pannel = await musicChannelManager.updateQueueEmbed(
                                guild_data.musicPannelId,
                                musicChannel,
                                player
                            );

                            if (message_pannel) {
                                client.logger.info(`[TRACK_START] Successfully updated music panel in ${musicChannel.name}`);
                            } else {
                                client.logger.warn(`[TRACK_START] Failed to update music panel in ${musicChannel.name}`);
                            }
                        } catch (error) {
                            client.logger.error(`[TRACK_START] Error updating music panel: ${error}`);
                            await musicChannelManager.createMusicEmbed(musicChannel);
                        }
                    }
                } catch (error) {
                    client.logger.error(`[TRACK_START] Error handling music channel: ${error}`);
                }
            }

            const shouldSendMessage = await shouldSendMessageInChannel(
                channel.id,
                player.guildId,
                client
            );

            if (shouldSendMessage) {
                const nowPlayingManager = NowPlayingManager.getInstance(
                    player.guildId,
                    player,
                    client
                );

                if (nowPlayingManager.hasMessage()) {
                    try {
                        nowPlayingManager.forceUpdate();
                        client.logger.debug(`[TRACK_START] Updated existing Now Playing message for ${track.title}`);
                    } catch (error) {
                        client.logger.warn(`[TRACK_START] Failed to update Now Playing message: ${error}`);
                        nowPlayingManager.destroy();

                        const embed = await musicEmbed(client, track, player);
                        try {
                            const message = await channel.send({
                                embeds: [embed],
                                components: [musicButton]
                            });

                            nowPlayingManager.setMessage(message, false);
                            client.logger.debug(`[TRACK_START] Created new Now Playing message for ${track.title}`);
                        } catch (error) {
                            client.logger.error(`[TRACK_START] Error sending Now Playing message: ${error}`);
                        }
                    }
                } else {
                    const embed = await musicEmbed(client, track, player);

                    try {
                        const message = await channel.send({
                            embeds: [embed],
                            components: [musicButton]
                        });

                        nowPlayingManager.setMessage(message, false);
                        client.logger.debug(`[TRACK_START] Created initial Now Playing message for ${track.title}`);
                    } catch (error: Error | any) {
                        if (error.code === 50007) {
                            client.logger.error(`[TRACK_START] Missing permissions to send messages in ${channel.name} (${channel.id})`);
                        } else {
                            client.logger.error(`[TRACK_START] Error sending message in ${channel.name} (${channel.id}): ${error}`);
                        }
                    }
                }
            } else {
                client.logger.debug(`[TRACK_START] Skipping Now Playing message in music channel ${channel.id}`);
            }

            logTrackStart(track, player, client);

        } catch (error) {
            client.logger.error(`[TRACK_START] Error in trackStart event: ${error}`);
        }
    },
};

export default lavalinkEvent;