import discord from "discord.js";
import MusicDB from "../../../utils/music/music_db";
import music_user from "../../database/schema/music_user";
import { BotEvent, ISongsUser } from "../../../types";

/**
 * Handles user presence updates to track Spotify activity
 * Captures song details when a user is listening to Spotify and saves them to their music history
 * Uses locking mechanism and atomic operations to prevent race conditions
 * Respects user preferences for tracking/not tracking
 */
const event: BotEvent = {
    name: discord.Events.PresenceUpdate,
    execute: async (
        oldPresence: discord.Presence | null,
        newPresence: discord.Presence | null,
        client: discord.Client
    ): Promise<void> => {
        try {
            // Skip if presence update is invalid or feature is disabled
            if (!newPresence?.user || !client.config.bot.features?.spotify_presence?.enabled) {
                return;
            }

            // Get Spotify activity if available
            const spotifyActivity = newPresence.activities.find(
                (activity) => activity.type === discord.ActivityType.Listening &&
                    activity.name === "Spotify" &&
                    activity.syncId
            );

            if (!spotifyActivity || !spotifyActivity.assets) return;

            const userId = newPresence.user.id;

            // Check if user has opted out of tracking
            const userSettings = await music_user.findOne({ userId });
            if (userSettings && userSettings.spotify_presence === false) {
                // User has explicitly opted out of tracking
                client.logger.debug(`[SPOTIFY_PRESENCE] User ${userId} has opted out of tracking`);
                return;
            }

            // Create Spotify URL from sync ID
            const spotifyUrl = `https://open.spotify.com/track/${spotifyActivity.syncId}`;

            // Initialize trackers if needed
            if (!(client as any).presenceTracker) {
                (client as any).presenceTracker = new Map();
            }

            if (!(client as any).presenceLocks) {
                (client as any).presenceLocks = new Map();
            }

            // Check if there's an active lock for this user - prevent concurrent processing
            const userLockKey = `lock:${userId}`;
            if ((client as any).presenceLocks.get(userLockKey)) {
                return; // Skip processing if another update for this user is in progress
            }

            // Check for recent duplicate entries (within 5 minutes)
            const lastAddedSongKey = `presence:${userId}:${spotifyActivity.syncId}`;
            const lastAdded = (client as any).presenceTracker.get(lastAddedSongKey);
            if (lastAdded && (Date.now() - lastAdded) < 5 * 60 * 1000) {
                return;
            }

            // Acquire lock for this user
            (client as any).presenceLocks.set(userLockKey, true);

            try {
                // Create requester data
                const requesterData: ISongsUser = {
                    id: userId,
                    username: newPresence.user.username,
                    discriminator: newPresence.user.discriminator || "0",
                    avatar: newPresence.user.avatar || undefined
                };

                // Search for track using Lavalink manager with direct Spotify URL
                const searchResult = await client.manager.search(spotifyUrl, newPresence.user);

                // Skip if no results
                if (searchResult.loadType === "empty" || !searchResult.tracks?.length) {
                    return;
                }

                // Use search result data
                const track = searchResult.tracks[0];

                // Create song data object with enhanced metadata
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

                // Use atomic update to add or update the song - prevents race conditions
                await MusicDB.atomicAddMusicUserData(userId, songData);

                // Update tracker to prevent processing the same song again for 5 minutes
                (client as any).presenceTracker.set(lastAddedSongKey, Date.now());

                client.logger.debug(
                    `[SPOTIFY_PRESENCE] Tracked song for ${newPresence.user.tag}: ${songData.title} by ${songData.author}`
                );
            } catch (error) {
                client.logger.warn(`[SPOTIFY_PRESENCE] Error processing song: ${error}`);
            } finally {
                // Always release the lock, even if an error occurred
                (client as any).presenceLocks.delete(userLockKey);
            }
        } catch (error) {
            client.logger.error(`[SPOTIFY_PRESENCE] Error tracking presence: ${error}`);

            // Make sure we don't leave locks hanging in case of errors
            if (newPresence?.user) {
                const userLockKey = `lock:${newPresence.user.id}`;
                (client as any).presenceLocks?.delete(userLockKey);
            }
        }
    },
};

export default event;