import discord from "discord.js";

import { IMusicUser, IMusicGuild, ISongs } from "../../../types";
import music_user from "../../../events/database/schema/music_user";
import music_guild from "../../../events/database/schema/music_guild";


export class MusicDB {
    private static addMusicDB = async <T extends IMusicUser | IMusicGuild>(data: T, songs_data: ISongs): Promise<void> => {
        try {
            if (!data.songs) data.songs = [];
            songs_data.artworkUrl = songs_data.artworkUrl || songs_data.thumbnail || "https://www.shutterstock.com/image-illustration/no-music-sound-sign-symbol-260nw-1102194074.jpg";
            const songExists = data.songs.find((song) => song.uri === songs_data.uri);

            if (songExists) {
                songExists.played_number += 1;
                songExists.timestamp = new Date();
            } else {
                data.songs.push(songs_data);
            }
            await data.save();
        } catch (err) {
            throw new Error(`An error occurred while adding music data: ${err}`);
        }
    };

    public static addMusicUserData = async (userId: string | null, data: ISongs): Promise<void> => {
        try {
            if (!userId) throw new Error("User ID is required to add music data");

            let user = await music_user.findOne({ userId });
            if (!user) {
                user = new music_user({ userId, songs: [data] });
                await user.save();
            } else {
                await this.addMusicDB(user, data);
            }
        } catch (err) {
            throw new Error(`Failed to add music user data: ${err}`);
        }
    };

    public static userExists = async (userId: string): Promise<boolean> => {
        if (!userId) return false;
        const count = await music_user.countDocuments({ userId });
        return count > 0;
    };

    public static atomicAddMusicUserData = async (userId: string, songData: ISongs): Promise<void> => {
        try {
            const user = await music_user.findOne({ userId, "songs.uri": songData.uri });
            if (user) {
                await music_user.updateOne({ userId, "songs.uri": songData.uri }, { $inc: { "songs.$.played_number": 1 }, $set: { "songs.$.timestamp": new Date() } });
            } else {
                const userExists = await this.userExists(userId);

                if (userExists) {
                    await music_user.updateOne({ userId }, { $push: { songs: songData } });
                } else {
                    await music_user.create({ userId, songs: [songData] });
                }
            }
        } catch (err) {
            throw new Error(`Failed to add music user data atomically: ${err}`);
        }
    };

    public static addMusicGuildData = async (guildId: string | null, data: ISongs): Promise<void> => {
        try {
            if (!guildId) throw new Error("Guild ID is required to add music data");

            let guild = await music_guild.findOne({ guildId });
            if (!guild) {
                guild = new music_guild({ guildId, songs: [data], });
                await guild.save();
            } else {
                await this.addMusicDB(guild, data);
            }
        } catch (err) {
            throw new Error(`Failed to add music guild data: ${err}`);
        }
    };

    public static getUserMusicHistory = async (userId: string | null): Promise<{ songs: ISongs[] } | null> => {
        try {
            if (!userId) throw new Error("User ID is required to get music history");

            const user = await music_user.findOne({ userId });
            if (!user) return null;

            return { songs: user.songs || [] };
        } catch (err) {
            return { songs: [] };
        }
    };

    public static getGuildMusicHistory = async (guildId: string | null): Promise<{ songs: ISongs[] } | null> => {
        try {
            if (!guildId) throw new Error("Guild ID is required to get music history");

            const guild = await music_guild.findOne({ guildId });
            if (!guild) return null;

            return { songs: guild.songs || [] };
        } catch (err) {
            return { songs: [] };
        }
    };

    public static getGlobalMusicHistory = async (): Promise<{ songs: ISongs[] }> => {
        try {
            const allGuilds = await music_guild.find();
            if (!allGuilds || allGuilds.length === 0) return { songs: [] };

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

            const globalSongs = Object.values(combinedSongs).filter((song) => song.played_number > 0).sort((a, b) => b.played_number - a.played_number);
            return { songs: globalSongs };
        } catch (err) {
            return { songs: [] };
        }
    };

    public static removeUserSong = async (userId: string | null, uri: string): Promise<boolean> => {
        try {
            if (!userId) throw new Error("User ID is required to remove song");

            const user = await music_user.findOne({ userId });
            if (!user || !user.songs) return false;

            const initialLength = user.songs.length;
            user.songs = user.songs.filter((song) => song.uri !== uri);
            if (user.songs.length === initialLength) return false;

            await user.save();
            return true;
        } catch (err) {
            throw new Error(`Failed to remove user song: ${err}`);
        }
    };

    public static removeGuildSong = async (guildId: string | null, uri: string): Promise<boolean> => {
        try {
            if (!guildId) throw new Error("Guild ID is required to remove song");

            const guild = await music_guild.findOne({ guildId });
            if (!guild || !guild.songs) return false;

            const initialLength = guild.songs.length;
            guild.songs = guild.songs.filter((song) => song.uri !== uri);
            if (guild.songs.length === initialLength) return false;

            await guild.save();
            return true;
        } catch (err) {
            throw new Error(`Failed to remove guild song: ${err}`);
        }
    };

    public static clearUserHistory = async (userId: string | null): Promise<boolean> => {
        try {
            if (!userId) throw new Error("User ID is required to clear history");
            const result = await music_user.findOneAndUpdate({ userId }, { $set: { songs: [] } });
            return !!result;
        } catch (err) {
            throw new Error(`Failed to clear user music history: ${err}`);
        }
    };

    public static clearGuildHistory = async (guildId: string | null): Promise<boolean> => {
        try {
            if (!guildId) throw new Error("Guild ID is required to clear history");
            const result = await music_guild.findOneAndUpdate({ guildId }, { $set: { songs: [] } });
            return !!result;
        } catch (err) {
            throw new Error(`Failed to clear guild music history: ${err}`);
        }
    };

    public static getUserTopSongs = async (userId: string | null, limit: number = 10): Promise<ISongs[]> => {
        try {
            if (!userId) throw new Error("User ID is required to get top songs");
            const user = await music_user.findOne({ userId });
            if (!user || !user.songs || !Array.isArray(user.songs)) return []
            return user.songs
                .sort((a, b) => (b.played_number || 0) - (a.played_number || 0))
                .slice(0, limit);
        } catch (err) {
            return [];
        }
    };

    public static getGuildTopSongs = async (guildId: string | null, limit: number = 10): Promise<ISongs[]> => {
        try {
            if (!guildId) throw new Error("Guild ID is required to get top songs");
            const guild = await music_guild.findOne({ guildId });
            if (!guild || !guild.songs || !Array.isArray(guild.songs)) return [];
            return guild.songs.sort((a, b) => (b.played_number || 0) - (a.played_number || 0)).slice(0, limit);
        } catch (err) {
            return [];
        }
    };

    public static getSongTextChannelId = async (client: discord.Client, guildId: string | null, userId: string | null): Promise<string> => {
        try {
            if (!guildId) throw new Error("Guild ID is required to get song text channel");
            if (!userId) throw new Error("User ID is required to get song text channel");

            const guild = client.guilds.cache.get(guildId);
            if (!guild) throw new Error("Guild not found");

            const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
            if (member && member.voice.channel) return member.voice.channel.id;

            const systemChannel = guild.systemChannelId;
            if (systemChannel) return systemChannel;

            const textChannel = guild.channels.cache.find(c => c.type === discord.ChannelType.GuildText);
            if (textChannel) return textChannel.id;

            throw new Error("No suitable text channel found in the guild");
        } catch (err) {
            throw new Error(`Failed to get song text channel ID: ${err}`);
        }
    };
};