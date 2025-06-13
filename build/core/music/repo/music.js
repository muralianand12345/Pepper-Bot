"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusicDB = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const music_user_1 = __importDefault(require("../../../events/database/schema/music_user"));
const music_guild_1 = __importDefault(require("../../../events/database/schema/music_guild"));
class MusicDB {
}
exports.MusicDB = MusicDB;
_a = MusicDB;
MusicDB.addMusicDB = async (data, songs_data) => {
    try {
        if (!data.songs)
            data.songs = [];
        songs_data.artworkUrl = songs_data.artworkUrl || songs_data.thumbnail || 'https://www.shutterstock.com/image-illustration/no-music-sound-sign-symbol-260nw-1102194074.jpg';
        const songExists = data.songs.find((song) => song.uri === songs_data.uri);
        if (songExists) {
            songExists.played_number += 1;
            songExists.timestamp = new Date();
        }
        else {
            data.songs.push(songs_data);
        }
        await data.save();
    }
    catch (err) {
        throw new Error(`An error occurred while adding music data: ${err}`);
    }
};
MusicDB.addMusicUserData = async (userId, data) => {
    try {
        if (!userId)
            throw new Error('User ID is required to add music data');
        let user = await music_user_1.default.findOne({ userId });
        if (!user) {
            user = new music_user_1.default({ userId, songs: [data] });
            await user.save();
        }
        else {
            await _a.addMusicDB(user, data);
        }
    }
    catch (err) {
        throw new Error(`Failed to add music user data: ${err}`);
    }
};
MusicDB.userExists = async (userId) => {
    if (!userId)
        return false;
    const count = await music_user_1.default.countDocuments({ userId });
    return count > 0;
};
MusicDB.atomicAddMusicUserData = async (userId, songData) => {
    try {
        const user = await music_user_1.default.findOne({ userId, 'songs.uri': songData.uri });
        if (user) {
            await music_user_1.default.updateOne({ userId, 'songs.uri': songData.uri }, { $inc: { 'songs.$.played_number': 1 }, $set: { 'songs.$.timestamp': new Date() } });
        }
        else {
            const userExists = await _a.userExists(userId);
            if (userExists) {
                await music_user_1.default.updateOne({ userId }, { $push: { songs: songData } });
            }
            else {
                await music_user_1.default.create({ userId, songs: [songData] });
            }
        }
    }
    catch (err) {
        throw new Error(`Failed to add music user data atomically: ${err}`);
    }
};
MusicDB.addMusicGuildData = async (guildId, data) => {
    try {
        if (!guildId)
            throw new Error('Guild ID is required to add music data');
        let guild = await music_guild_1.default.findOne({ guildId });
        if (!guild) {
            guild = new music_guild_1.default({ guildId, songs: [data] });
            await guild.save();
        }
        else {
            await _a.addMusicDB(guild, data);
        }
    }
    catch (err) {
        throw new Error(`Failed to add music guild data: ${err}`);
    }
};
MusicDB.getUserMusicHistory = async (userId) => {
    try {
        if (!userId)
            throw new Error('User ID is required to get music history');
        const user = await music_user_1.default.findOne({ userId });
        if (!user)
            return null;
        return { songs: user.songs || [] };
    }
    catch (err) {
        return { songs: [] };
    }
};
MusicDB.getGuildMusicHistory = async (guildId) => {
    try {
        if (!guildId)
            throw new Error('Guild ID is required to get music history');
        const guild = await music_guild_1.default.findOne({ guildId });
        if (!guild)
            return null;
        return { songs: guild.songs || [] };
    }
    catch (err) {
        return { songs: [] };
    }
};
MusicDB.getGlobalMusicHistory = async () => {
    try {
        const allGuilds = await music_guild_1.default.find();
        if (!allGuilds || allGuilds.length === 0)
            return { songs: [] };
        const combinedSongs = {};
        allGuilds.forEach((guild) => {
            if (!guild.songs || !Array.isArray(guild.songs))
                return;
            guild.songs.forEach((song) => {
                if (!song.uri || !song.title || !song.author)
                    return;
                if (!song.played_number || song.played_number <= 0)
                    return;
                const key = song.uri;
                if (combinedSongs[key]) {
                    combinedSongs[key].played_number += song.played_number;
                }
                else {
                    combinedSongs[key] = {
                        ...song,
                        title: song.title || 'Unknown Title',
                        author: song.author || 'Unknown Artist',
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
    }
    catch (err) {
        return { songs: [] };
    }
};
MusicDB.removeUserSong = async (userId, uri) => {
    try {
        if (!userId)
            throw new Error('User ID is required to remove song');
        const user = await music_user_1.default.findOne({ userId });
        if (!user || !user.songs)
            return false;
        const initialLength = user.songs.length;
        user.songs = user.songs.filter((song) => song.uri !== uri);
        if (user.songs.length === initialLength)
            return false;
        await user.save();
        return true;
    }
    catch (err) {
        throw new Error(`Failed to remove user song: ${err}`);
    }
};
MusicDB.removeGuildSong = async (guildId, uri) => {
    try {
        if (!guildId)
            throw new Error('Guild ID is required to remove song');
        const guild = await music_guild_1.default.findOne({ guildId });
        if (!guild || !guild.songs)
            return false;
        const initialLength = guild.songs.length;
        guild.songs = guild.songs.filter((song) => song.uri !== uri);
        if (guild.songs.length === initialLength)
            return false;
        await guild.save();
        return true;
    }
    catch (err) {
        throw new Error(`Failed to remove guild song: ${err}`);
    }
};
MusicDB.clearUserHistory = async (userId) => {
    try {
        if (!userId)
            throw new Error('User ID is required to clear history');
        const result = await music_user_1.default.findOneAndUpdate({ userId }, { $set: { songs: [] } });
        return !!result;
    }
    catch (err) {
        throw new Error(`Failed to clear user music history: ${err}`);
    }
};
MusicDB.clearGuildHistory = async (guildId) => {
    try {
        if (!guildId)
            throw new Error('Guild ID is required to clear history');
        const result = await music_guild_1.default.findOneAndUpdate({ guildId }, { $set: { songs: [] } });
        return !!result;
    }
    catch (err) {
        throw new Error(`Failed to clear guild music history: ${err}`);
    }
};
MusicDB.getUserTopSongs = async (userId, limit = 10) => {
    try {
        if (!userId)
            throw new Error('User ID is required to get top songs');
        const user = await music_user_1.default.findOne({ userId });
        if (!user || !user.songs || !Array.isArray(user.songs))
            return [];
        return user.songs.sort((a, b) => (b.played_number || 0) - (a.played_number || 0)).slice(0, limit);
    }
    catch (err) {
        return [];
    }
};
MusicDB.getGuildTopSongs = async (guildId, limit = 10) => {
    try {
        if (!guildId)
            throw new Error('Guild ID is required to get top songs');
        const guild = await music_guild_1.default.findOne({ guildId });
        if (!guild || !guild.songs || !Array.isArray(guild.songs))
            return [];
        return guild.songs.sort((a, b) => (b.played_number || 0) - (a.played_number || 0)).slice(0, limit);
    }
    catch (err) {
        return [];
    }
};
MusicDB.getSongTextChannelId = async (client, guildId, userId) => {
    try {
        if (!guildId)
            throw new Error('Guild ID is required to get song text channel');
        if (!userId)
            throw new Error('User ID is required to get song text channel');
        const guild = client.guilds.cache.get(guildId);
        if (!guild)
            throw new Error('Guild not found');
        const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId));
        if (member && member.voice.channel)
            return member.voice.channel.id;
        const systemChannel = guild.systemChannelId;
        if (systemChannel)
            return systemChannel;
        const textChannel = guild.channels.cache.find((c) => c.type === discord_js_1.default.ChannelType.GuildText);
        if (textChannel)
            return textChannel.id;
        throw new Error('No suitable text channel found in the guild');
    }
    catch (err) {
        throw new Error(`Failed to get song text channel ID: ${err}`);
    }
};
