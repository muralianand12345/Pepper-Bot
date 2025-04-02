import discord from "discord.js";
import MusicDB from "../../../utils/music/music_db";
import { BotEvent, ISongsUser } from "../../../types";

/**
 * Handles user presence updates to track Spotify activity
 * Captures song details when a user is listening to Spotify and saves them to their music history
 */
const event: BotEvent = {
    name: discord.Events.PresenceUpdate,
    execute: async (
        oldPresence: discord.Presence | null,
        newPresence: discord.Presence | null,
        client: discord.Client
    ): Promise<void> => {
        try {
            // Return if we don't have a valid presence update
            if (!newPresence || !newPresence.user) return;

            // Load settings from database to check if tracking is enabled globally
            if (!client.config.bot.features?.spotify_presence?.enabled) {
                return;
            }

            // Check if the user has Spotify activity
            const spotifyActivity = newPresence.activities.find(
                (activity) => activity.type === discord.ActivityType.Listening &&
                    activity.name === "Spotify" &&
                    activity.syncId // Only process if we have a Spotify sync ID
            );

            if (!spotifyActivity) return;

            // Get the Spotify details from the activity
            const spotifyData = spotifyActivity.assets;
            if (!spotifyData) return;

            //TODO: use await client.manager.search("songs name + url", newPresence.user) to get the song data and add to the db

            // // Parse Spotify data
            // const songTitle = spotifyActivity.details || "Unknown Title";
            // const songAuthor = spotifyActivity.state?.split("; ").join(", ") || "Unknown Artist";
            // const albumName = spotifyActivity.assets?.largeText || "Unknown Album";
            // const albumCover = spotifyActivity.assets?.largeImageURL() || "";
            // const songDuration = spotifyActivity.timestamps ?
            //     (spotifyActivity.timestamps.end?.getTime() || 0) -
            //     (spotifyActivity.timestamps.start?.getTime() || 0) : 0;
                

            // // Create timestamp
            // const timestamp = new Date();

            // // Generate a consistent, unique URI for the Spotify track
            // const spotifyUri = `spotify:track:${spotifyActivity.syncId}`;
            // const spotifyUrl = `https://open.spotify.com/track/${spotifyActivity.syncId}`;

            // // Create requester data
            // const requesterData: ISongsUser = {
            //     id: newPresence.user.id,
            //     username: newPresence.user.username,
            //     discriminator: newPresence.user.discriminator || "0",
            //     avatar: newPresence.user.avatar || undefined
            // };

            // // Create song data object
            // const songData = {
            //     track: songTitle,
            //     artworkUrl: albumCover,
            //     sourceName: "spotify",
            //     title: songTitle,
            //     identifier: spotifyActivity.syncId || `spotify_${Date.now()}`,
            //     author: songAuthor,
            //     duration: songDuration,
            //     isrc: "",
            //     isSeekable: true,
            //     isStream: false,
            //     uri: spotifyUrl,
            //     thumbnail: albumCover,
            //     requester: requesterData,
            //     played_number: 1,
            //     presence_song: true, // Mark that this song was detected via presence
            //     timestamp: timestamp
            // };

            // // Check if we've already added this song from this user's presence recently
            // // This prevents duplicate entries when presence updates frequently
            // // We use the user ID and song URI to check for duplicates
            // const lastAddedSongKey = `presence:${newPresence.user.id}:${spotifyUri}`;
            // const lastAdded = (client as any).presenceTracker?.get(lastAddedSongKey);

            // // If we've added this song in the last 5 minutes, don't add it again
            // if (lastAdded && (Date.now() - lastAdded) < 5 * 60 * 1000) {
            //     return;
            // }

            // // Save the song to user's music history
            // await MusicDB.addMusicUserData(newPresence.user.id, songData);

            // // Save the timestamp to prevent duplicates
            // if (!(client as any).presenceTracker) {
            //     (client as any).presenceTracker = new Map();
            // }
            // (client as any).presenceTracker.set(lastAddedSongKey, Date.now());

            // // Log the activity
            // client.logger.debug(
            //     `[SPOTIFY_PRESENCE] Tracked song for ${newPresence.user.tag}: ${songTitle} by ${songAuthor}`
            // );
        } catch (error) {
            client.logger.error(`[SPOTIFY_PRESENCE] Error tracking presence: ${error}`);
        }
    },
};

export default event;