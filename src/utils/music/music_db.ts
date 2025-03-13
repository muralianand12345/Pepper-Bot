import music_user from "../../events/database/schema/music_user";
import music_guild from "../../events/database/schema/music_guild";
import { IMusicUser, IMusicGuild, ISongs } from "../../types";

/**
 * Class handling music database operations for both users and guilds
 * @class MusicDB
 */
class MusicDB {
    /**
     * Updates or adds a song to a document's music data
     * @param data - Music data document (user or guild)
     * @param songs_data - Song data to be added or updated
     * @throws Error if database operation fails
     * @private
     */
    private static async addMusicDB<T extends IMusicUser | IMusicGuild>(
        data: T,
        songs_data: ISongs
    ): Promise<void> {
        try {
            if (!data.songs) {
                data.songs = [];
            }

            const songExists = data.songs.find(
                (song) => song.uri === songs_data.uri
            );

            if (songExists) {
                songExists.played_number += 1;
                songExists.timestamp = new Date();
            } else {
                data.songs.push(songs_data);
            }

            await data.save();
        } catch (err) {
            throw new Error(
                `An error occurred while adding music data: ${err}`
            );
        }
    }

    /**
     * Adds or updates music data for a user
     * @param userId - Discord user ID
     * @param data - Song data to be added
     * @returns Promise<void>
     * @throws Error if userId is null or if database operation fails
     * @public
     */
    public static async addMusicUserData(
        userId: string | null,
        data: ISongs
    ): Promise<void> {
        try {
            if (!userId) {
                throw new Error("User ID is required to add music data");
            }

            let user = await music_user.findOne({ userId });

            if (!user) {
                user = new music_user({
                    userId,
                    songs: [data],
                });
                await user.save();
            } else {
                await this.addMusicDB(user, data);
            }
        } catch (err) {
            throw new Error(`Failed to add music user data: ${err}`);
        }
    }

    /**
     * Adds or updates music data for a guild
     * @param guildId - Discord guild ID
     * @param data - Song data to be added
     * @returns Promise<void>
     * @throws Error if guildId is null or if database operation fails
     * @public
     */
    public static async addMusicGuildData(
        guildId: string | null,
        data: ISongs
    ): Promise<void> {
        try {
            if (!guildId) {
                throw new Error("Guild ID is required to add music data");
            }

            let guild = await music_guild.findOne({ guildId });

            if (!guild) {
                guild = new music_guild({
                    guildId,
                    songs: [data],
                });
                await guild.save();
            } else {
                await this.addMusicDB(guild, data);
            }
        } catch (err) {
            throw new Error(`Failed to add music guild data: ${err}`);
        }
    }

    /**
     * Retrieves a user's music history
     * @param userId - Discord user ID
     * @returns Promise with music history or null
     * @throws Error if userId is null or if database operation fails
     * @public
     */
    public static async getUserMusicHistory(
        userId: string | null
    ): Promise<{ songs: ISongs[] } | null> {
        try {
            if (!userId) {
                throw new Error("User ID is required to get music history");
            }

            const user = await music_user.findOne({ userId });

            if (!user) {
                return null;
            }

            return {
                songs: user.songs || [],
            };
        } catch (err) {
            return { songs: [] };
        }
    }

    /**
     * Retrieves a guild's music history
     * @param guildId - Discord guild ID
     * @returns Promise with music history or null
     * @throws Error if guildId is null or if database operation fails
     * @public
     */
    public static async getGuildMusicHistory(
        guildId: string | null
    ): Promise<{ songs: ISongs[] } | null> {
        try {
            if (!guildId) {
                throw new Error("Guild ID is required to get music history");
            }

            const guild = await music_guild.findOne({ guildId });

            if (!guild) {
                return null;
            }

            return {
                songs: guild.songs || [],
            };
        } catch (err) {
            return { songs: [] };
        }
    }

    /**
     * Retrieves global music history across all guilds
     * @returns Promise with combined song stats
     * @throws Error if database operation fails
     * @public
     */
    public static async getGlobalMusicHistory(): Promise<{ songs: ISongs[] }> {
        try {
            const allGuilds = await music_guild.find();

            // Edge case: no guild data found
            if (!allGuilds || allGuilds.length === 0) {
                return { songs: [] };
            }

            const combinedSongs: Record<string, ISongs> = {};

            allGuilds.forEach((guild) => {
                // Add null check for guild.songs
                if (!guild.songs || !Array.isArray(guild.songs)) return;

                guild.songs.forEach((song) => {
                    // Skip songs with missing essential data
                    if (!song.uri || !song.title || !song.author) return;

                    // Make sure played_number is a number greater than 0
                    if (!song.played_number || song.played_number <= 0) return;

                    const key = song.uri;
                    if (combinedSongs[key]) {
                        combinedSongs[key].played_number += song.played_number;
                    } else {
                        // Create a clean copy with all required fields
                        combinedSongs[key] = {
                            ...song,
                            // Ensure these fields exist
                            title: song.title || "Unknown Title",
                            author: song.author || "Unknown Artist",
                            played_number: song.played_number || 0,
                            duration: song.duration || 0,
                            timestamp: song.timestamp || new Date(),
                        };
                    }
                });
            });

            // Convert to array and sort by play count
            const globalSongs = Object.values(combinedSongs)
                .filter((song) => song.played_number > 0) // Extra safeguard
                .sort((a, b) => b.played_number - a.played_number);

            return { songs: globalSongs };
        } catch (err) {
            // Return empty songs array rather than throwing
            return { songs: [] };
        }
    }

    /**
     * Removes a song from a user's music history
     * @param userId - Discord user ID
     * @param uri - Song URI to remove
     * @returns Promise<boolean> - True if song was removed, false if not found
     * @throws Error if userId is null or if database operation fails
     * @public
     */
    public static async removeUserSong(
        userId: string | null,
        uri: string
    ): Promise<boolean> {
        try {
            if (!userId) {
                throw new Error("User ID is required to remove song");
            }

            const user = await music_user.findOne({ userId });
            if (!user || !user.songs) {
                return false;
            }

            const initialLength = user.songs.length;
            user.songs = user.songs.filter((song) => song.uri !== uri);

            if (user.songs.length === initialLength) {
                return false;
            }

            await user.save();
            return true;
        } catch (err) {
            throw new Error(`Failed to remove user song: ${err}`);
        }
    }

    /**
     * Removes a song from a guild's music history
     * @param guildId - Discord guild ID
     * @param uri - Song URI to remove
     * @returns Promise<boolean> - True if song was removed, false if not found
     * @throws Error if guildId is null or if database operation fails
     * @public
     */
    public static async removeGuildSong(
        guildId: string | null,
        uri: string
    ): Promise<boolean> {
        try {
            if (!guildId) {
                throw new Error("Guild ID is required to remove song");
            }

            const guild = await music_guild.findOne({ guildId });
            if (!guild || !guild.songs) {
                return false;
            }

            const initialLength = guild.songs.length;
            guild.songs = guild.songs.filter((song) => song.uri !== uri);

            if (guild.songs.length === initialLength) {
                return false;
            }

            await guild.save();
            return true;
        } catch (err) {
            throw new Error(`Failed to remove guild song: ${err}`);
        }
    }

    /**
     * Clears all music history for a user
     * @param userId - Discord user ID
     * @returns Promise<boolean> - True if history was cleared, false if user not found
     * @throws Error if userId is null or if database operation fails
     * @public
     */
    public static async clearUserHistory(
        userId: string | null
    ): Promise<boolean> {
        try {
            if (!userId) {
                throw new Error("User ID is required to clear history");
            }

            const result = await music_user.findOneAndUpdate(
                { userId },
                { $set: { songs: [] } }
            );

            return !!result;
        } catch (err) {
            throw new Error(`Failed to clear user music history: ${err}`);
        }
    }

    /**
     * Clears all music history for a guild
     * @param guildId - Discord guild ID
     * @returns Promise<boolean> - True if history was cleared, false if guild not found
     * @throws Error if guildId is null or if database operation fails
     * @public
     */
    public static async clearGuildHistory(
        guildId: string | null
    ): Promise<boolean> {
        try {
            if (!guildId) {
                throw new Error("Guild ID is required to clear history");
            }

            const result = await music_guild.findOneAndUpdate(
                { guildId },
                { $set: { songs: [] } }
            );

            return !!result;
        } catch (err) {
            throw new Error(`Failed to clear guild music history: ${err}`);
        }
    }

    /**
     * Gets the top played songs for a user
     * @param userId - Discord user ID
     * @param limit - Number of songs to return (default: 10)
     * @returns Promise<ISongs[]> - Array of top played songs
     * @throws Error if userId is null or if database operation fails
     * @public
     */
    public static async getUserTopSongs(
        userId: string | null,
        limit: number = 10
    ): Promise<ISongs[]> {
        try {
            if (!userId) {
                throw new Error("User ID is required to get top songs");
            }

            const user = await music_user.findOne({ userId });
            if (!user || !user.songs || !Array.isArray(user.songs)) {
                return [];
            }

            return user.songs
                .sort((a, b) => (b.played_number || 0) - (a.played_number || 0))
                .slice(0, limit);
        } catch (err) {
            return [];
        }
    }

    /**
     * Gets the top played songs for a guild
     * @param guildId - Discord guild ID
     * @param limit - Number of songs to return (default: 10)
     * @returns Promise<ISongs[]> - Array of top played songs
     * @throws Error if guildId is null or if database operation fails
     * @public
     */
    public static async getGuildTopSongs(
        guildId: string | null,
        limit: number = 10
    ): Promise<ISongs[]> {
        try {
            if (!guildId) {
                throw new Error("Guild ID is required to get top songs");
            }

            const guild = await music_guild.findOne({ guildId });
            if (!guild || !guild.songs || !Array.isArray(guild.songs)) {
                return [];
            }

            return guild.songs
                .sort((a, b) => (b.played_number || 0) - (a.played_number || 0))
                .slice(0, limit);
        } catch (err) {
            return [];
        }
    }
}

export default MusicDB;
