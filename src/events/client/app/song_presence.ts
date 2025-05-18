import discord from "discord.js";
import MusicDB from "../../../utils/music/music_db";
import music_user from "../../database/schema/music_user";
import { BotEvent, ISongsUser } from "../../../types";

const event: BotEvent = {
    name: discord.Events.PresenceUpdate,
    execute: async (
        oldPresence: discord.Presence | null,
        newPresence: discord.Presence | null,
        client: discord.Client
    ): Promise<void> => {
        try {
            if (!newPresence?.user || !client.config.bot.features?.spotify_presence?.enabled) {
                return;
            }

            const spotifyActivity = newPresence.activities.find(
                (activity) => activity.type === discord.ActivityType.Listening &&
                    activity.name === "Spotify" &&
                    activity.syncId
            );

            if (!spotifyActivity || !spotifyActivity.assets) return;

            const userId = newPresence.user.id;
            const userSettings = await music_user.findOne({ userId });
            if (userSettings && userSettings.spotify_presence === false) {
                client.logger.debug(`[SPOTIFY_PRESENCE] User ${userId} has opted out of tracking`);
                return;
            }

            const spotifyUrl = `https://open.spotify.com/track/${spotifyActivity.syncId}`;

            if (!(client as any).presenceTracker) {
                (client as any).presenceTracker = new Map();
            }

            if (!(client as any).presenceLocks) {
                (client as any).presenceLocks = new Map();
            }

            const userLockKey = `lock:${userId}`;
            if ((client as any).presenceLocks.get(userLockKey)) {
                return;
            }

            const lastAddedSongKey = `presence:${userId}:${spotifyActivity.syncId}`;
            const lastAdded = (client as any).presenceTracker.get(lastAddedSongKey);
            if (lastAdded && (Date.now() - lastAdded) < 5 * 60 * 1000) {
                return;
            }

            (client as any).presenceLocks.set(userLockKey, true);

            try {
                const requesterData: ISongsUser = {
                    id: userId,
                    username: newPresence.user.username,
                    discriminator: newPresence.user.discriminator || "0",
                    avatar: newPresence.user.avatar || undefined
                };

                const searchResult = await client.manager.search(spotifyUrl, newPresence.user);
                if (searchResult.loadType === "empty" || !searchResult.tracks?.length) {
                    return;
                }

                const track = searchResult.tracks[0];
                const songData = {
                    track: track.title,
                    artworkUrl: track.artworkUrl,
                    sourceName: track.sourceName,
                    title: track.title,
                    identifier: track.identifier,
                    author: track.author,
                    duration: track.duration,
                    isrc: track.isrc,
                    isSeekable: track.isSeekable !== undefined ? track.isSeekable : true,
                    isStream: track.isStream,
                    uri: track.uri,
                    thumbnail: track.thumbnail,
                    requester: requesterData,
                    played_number: 1,
                    timestamp: new Date()
                };

                await MusicDB.atomicAddMusicUserData(userId, songData);
                (client as any).presenceTracker.set(lastAddedSongKey, Date.now());

                client.logger.debug(
                    `[SPOTIFY_PRESENCE] Tracked song for ${newPresence.user.tag}: ${songData.title} by ${songData.author}`
                );
            } catch (error) {
                client.logger.warn(`[SPOTIFY_PRESENCE] Error processing song: ${error}`);
            } finally {
                (client as any).presenceLocks.delete(userLockKey);
            }
        } catch (error) {
            client.logger.error(`[SPOTIFY_PRESENCE] Error tracking presence: ${error}`);
            if (newPresence?.user) {
                const userLockKey = `lock:${newPresence.user.id}`;
                (client as any).presenceLocks?.delete(userLockKey);
            }
        }
    },
};

export default event;