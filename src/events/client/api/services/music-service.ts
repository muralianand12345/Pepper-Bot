import discord from 'discord.js';
import { PlayerDto, DetailedPlayerDto, MusicHistoryDto } from '../dto/music-dto';

interface MusicDBSong {
    title: string;
    author: string;
    sourceName: string;
    uri: string;
    played_number: number;
    timestamp: Date;
    artworkUrl?: string;
    thumbnail?: string;
}

class MusicService {
    private readonly client: discord.Client;

    constructor(client: discord.Client) {
        this.client = client;
    }

    public getAllPlayers(): PlayerDto[] {
        if (!this.client.manager) {
            return [];
        }

        const players = this.client.manager.players;

        return Array.from(players.values()).map(player => {
            const guild = this.client.guilds.cache.get(player.guildId);

            // Get current track information
            const currentTrack = player.queue.current ? {
                title: player.queue.current.title,
                author: player.queue.current.author,
                duration: player.queue.current.duration,
                position: player.position,
                uri: player.queue.current.uri,
                sourceName: player.queue.current.sourceName,
                artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
            } : null;

            return {
                guildId: player.guildId,
                guildName: guild ? guild.name : 'Unknown',
                playing: player.playing,
                paused: player.paused,
                volume: player.volume,
                currentTrack,
                queueSize: player.queue.size
            };
        });
    }

    public getPlayerById(guildId: string): DetailedPlayerDto | null {
        if (!this.client.manager) {
            return null;
        }

        // Get the player for the specified guild
        const player = this.client.manager.get(guildId);

        if (!player) {
            return null;
        }

        const guild = this.client.guilds.cache.get(guildId);

        // Get current track information
        const currentTrack = player.queue.current ? {
            title: player.queue.current.title,
            author: player.queue.current.author,
            duration: player.queue.current.duration,
            position: player.position,
            uri: player.queue.current.uri,
            sourceName: player.queue.current.sourceName,
            artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
        } : null;

        // Get queue information
        const queue = player.queue.map(track => ({
            title: track.title,
            author: track.author,
            duration: track.duration,
            uri: track.uri,
            sourceName: track.sourceName,
            artworkUrl: track.artworkUrl || track.thumbnail
        }));

        return {
            guildId: player.guildId,
            guildName: guild ? guild.name : 'Unknown',
            playing: player.playing,
            paused: player.paused,
            volume: player.volume,
            trackRepeat: player.trackRepeat,
            queueRepeat: player.queueRepeat,
            currentTrack,
            queueSize: player.queue.size,
            queue
        };
    }

    public async getGuildMusicHistory(guildId: string, limit: number = 10): Promise<MusicHistoryDto[] | null> {
        try {
            // Use MusicDB utility to get guild history
            const MusicDB = require('../../../../utils/music/music_db').default;
            const history = await MusicDB.getGuildMusicHistory(guildId);

            if (!history || !history.songs || history.songs.length === 0) {
                return null;
            }

            // Format history data for API response
            return history.songs
                .sort((a: MusicDBSong, b: MusicDBSong) => b.played_number - a.played_number)
                .slice(0, limit)
                .map((song: MusicDBSong) => ({
                    title: song.title,
                    author: song.author,
                    sourceName: song.sourceName,
                    uri: song.uri,
                    playCount: song.played_number,
                    lastPlayed: song.timestamp,
                    artworkUrl: song.artworkUrl || song.thumbnail
                }));
        } catch (error) {
            throw error;
        }
    }

    public async getUserMusicHistory(userId: string, limit: number = 10): Promise<MusicHistoryDto[] | null> {
        try {
            // Use MusicDB utility to get user history
            const MusicDB = require('../../../../utils/music/music_db').default;
            const history = await MusicDB.getUserMusicHistory(userId);

            if (!history || !history.songs || history.songs.length === 0) {
                return null;
            }

            // Format history data for API response
            return history.songs
                .sort((a: MusicDBSong, b: MusicDBSong) => b.played_number - a.played_number)
                .slice(0, limit)
                .map((song: MusicDBSong) => ({
                    title: song.title,
                    author: song.author,
                    sourceName: song.sourceName,
                    uri: song.uri,
                    playCount: song.played_number,
                    lastPlayed: song.timestamp,
                    artworkUrl: song.artworkUrl || song.thumbnail
                }));
        } catch (error) {
            throw error;
        }
    }
}

export default MusicService;