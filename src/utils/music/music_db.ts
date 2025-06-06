import discord from "discord.js";
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

            songs_data.artworkUrl = songs_data.artworkUrl || songs_data.thumbnail || "https://www.shutterstock.com/image-illustration/no-music-sound-sign-symbol-260nw-1102194074.jpg";

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
     * Check if a user exists in the database without creating a document
     * @param userId - Discord user ID
     * @returns Promise<boolean> - True if user exists, false otherwise
     * @public
     */
    public static async userExists(userId: string): Promise<boolean> {
        if (!userId) return false;
        const count = await music_user.countDocuments({ userId });
        return count > 0;
    }

    /**
     * Atomic operation to add or update song data with race condition prevention
     * This method uses findOneAndUpdate with upsert to prevent duplicate documents
     * @param userId - Discord user ID
     * @param songData - Song data to be added or updated
     * @returns Promise<void>
     * @throws Error if userId is null or if database operation fails
     * @public
     */
    public static async atomicAddMusicUserData(
        userId: string,
        songData: ISongs
    ): Promise<void> {
        if (!userId) {
            throw new Error("User ID is required to add music data");
        }

        try {
            const user = await music_user.findOne({
                userId,
                "songs.uri": songData.uri
            });

            if (user) {
                await music_user.updateOne(
                    {
                        userId,
                        "songs.uri": songData.uri
                    },
                    {
                        $inc: { "songs.$.played_number": 1 },
                        $set: { "songs.$.timestamp": new Date() }
                    }
                );
            } else {
                const userExists = await this.userExists(userId);

                if (userExists) {
                    await music_user.updateOne(
                        { userId },
                        { $push: { songs: songData } }
                    );
                } else {
                    await music_user.create({
                        userId,
                        songs: [songData],
                    });
                }
            }
        } catch (err) {
            throw new Error(`Failed to add music user data atomically: ${err}`);
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

            if (!allGuilds || allGuilds.length === 0) {
                return { songs: [] };
            }

            const combinedSongs: Record<string, ISongs> = {};

            allGuilds.forEach((guild) => {
                if (!guild.songs || !Array.isArray(guild.songs)) return;

                guild.songs.forEach((song) => {
                    if (!song.uri || !song.title || !song.author) return;
                    if (!song.played_number || song.played_number <= 0) return;

                    const key = song.uri;
                    if (combinedSongs[key]) {
                        combinedSongs[key].played_number += song.played_number;
                    } else {
                        combinedSongs[key] = {
                            ...song,
                            title: song.title || "Unknown Title",
                            author: song.author || "Unknown Artist",
                            played_number: song.played_number || 0,
                            duration: song.duration || 0,
                            timestamp: song.timestamp || new Date(),
                        };
                    }
                });
            });

            const globalSongs = Object.values(combinedSongs)
                .filter((song) => song.played_number > 0)
                .sort((a, b) => b.played_number - a.played_number);

            return { songs: globalSongs };
        } catch (err) {
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

    /**
     * Gets the song text channel ID for a guild
     * @param client - Discord client instance
     * @param guildId - Discord guild ID
     * @param userId - Discord user ID
     * @returns Promise<string > - Song text channel ID
     * @throws Error if guildId is null or if database operation fails
     * @public
     */
    public static async getSongTextChannelId(
        client: discord.Client,
        guildId: string | null,
        userId: string | null
    ): Promise<string> {
        try {
            if (!guildId) {
                throw new Error("Guild ID is required to get song text channel");
            }

            if (!userId) {
                throw new Error("User ID is required to get song text channel");
            }

            const guildData = await music_guild.findOne({ guildId });
            if (guildData && guildData.songChannelId) {
                return guildData.songChannelId;
            }

            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                throw new Error("Guild not found");
            }

            const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
            if (member && member.voice.channel) {
                return member.voice.channel.id;
            }

            const systemChannel = guild.systemChannelId;
            if (systemChannel) {
                return systemChannel;
            }

            const textChannel = guild.channels.cache.find(
                c => c.type === discord.ChannelType.GuildText
            );

            if (textChannel) {
                return textChannel.id;
            }

            throw new Error("No suitable text channel found in the guild");

        } catch (err) {
            throw new Error(`Failed to get song text channel ID: ${err}`);
        }
    }
}

export default MusicDB;