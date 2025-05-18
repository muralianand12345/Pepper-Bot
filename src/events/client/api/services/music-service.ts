import discord from 'discord.js';
import magmastream from 'magmastream';
import { PlayerDto, DetailedPlayerDto, MusicHistoryDto, MusicHistoryWithGuildDto } from '../dto/music-dto';
import { MusicDBSong, PaginationParams, PaginatedResponse } from '../../../../types';

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

        const player = this.client.manager.get(guildId);

        if (!player) {
            return null;
        }

        const guild = this.client.guilds.cache.get(guildId);
        const currentTrack = player.queue.current ? {
            title: player.queue.current.title,
            author: player.queue.current.author,
            duration: player.queue.current.duration,
            position: player.position,
            uri: player.queue.current.uri,
            sourceName: player.queue.current.sourceName,
            artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
        } : null;
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

    /**
     * Get paginated music history for a guild with sorting options
     * @param guildId - Discord guild ID
     * @param options - Enhanced pagination parameters with sorting
     * @returns Promise with paginated music history or null
     */
    public async getGuildMusicHistory(
        guildId: string,
        options: PaginationParams = {
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortDirection: 'desc'
        }
    ): Promise<PaginatedResponse<MusicHistoryDto> | null> {
        try {
            const MusicDB = require('../../../../utils/music/music_db').default;
            const history = await MusicDB.getGuildMusicHistory(guildId);

            if (!history || !history.songs || history.songs.length === 0) {
                return null;
            }

            const sortBy = options.sortBy || 'timestamp';
            const sortDirection = options.sortDirection || 'desc';
            const sortedSongs = [...history.songs].sort((a: MusicDBSong, b: MusicDBSong) => {
                if (sortBy === 'timestamp') {
                    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
                } else {
                    return sortDirection === 'desc'
                        ? (b.played_number || 0) - (a.played_number || 0)
                        : (a.played_number || 0) - (b.played_number || 0);
                }
            });

            const totalItems = sortedSongs.length;
            const totalPages = Math.ceil(totalItems / options.pageSize);
            const page = Math.min(Math.max(options.page, 1), totalPages || 1);
            const startIndex = (page - 1) * options.pageSize;
            const endIndex = Math.min(startIndex + options.pageSize, totalItems);
            const items = sortedSongs
                .slice(startIndex, endIndex)
                .map((song: MusicDBSong) => ({
                    title: song.title,
                    author: song.author,
                    sourceName: song.sourceName,
                    uri: song.uri,
                    played_number: song.played_number,
                    timestamp: song.timestamp,
                    artworkUrl: song.artworkUrl || song.thumbnail
                }));

            return {
                items,
                total: totalItems,
                page,
                pageSize: options.pageSize,
                totalPages
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get paginated music history for a user with sorting options
     * @param userId - Discord user ID
     * @param options - Enhanced pagination parameters with sorting
     * @returns Promise with paginated music history or null
     */
    public async getUserMusicHistory(
        userId: string,
        options: PaginationParams = {
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortDirection: 'desc'
        }
    ): Promise<PaginatedResponse<MusicHistoryDto> | null> {
        try {
            const MusicDB = require('../../../../utils/music/music_db').default;
            const history = await MusicDB.getUserMusicHistory(userId);

            if (!history || !history.songs || history.songs.length === 0) {
                return null;
            }

            const sortBy = options.sortBy || 'timestamp';
            const sortDirection = options.sortDirection || 'desc';
            const sortedSongs = [...history.songs].sort((a: MusicDBSong, b: MusicDBSong) => {
                if (sortBy === 'timestamp') {
                    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
                } else {
                    return sortDirection === 'desc'
                        ? (b.played_number || 0) - (a.played_number || 0)
                        : (a.played_number || 0) - (b.played_number || 0);
                }
            });
            const totalItems = sortedSongs.length;
            const totalPages = Math.ceil(totalItems / options.pageSize);
            const page = Math.min(Math.max(options.page, 1), totalPages || 1);
            const startIndex = (page - 1) * options.pageSize;
            const endIndex = Math.min(startIndex + options.pageSize, totalItems);
            const items = sortedSongs
                .slice(startIndex, endIndex)
                .map((song: MusicDBSong) => ({
                    title: song.title,
                    author: song.author,
                    sourceName: song.sourceName,
                    uri: song.uri,
                    played_number: song.played_number,
                    timestamp: song.timestamp,
                    artworkUrl: song.artworkUrl || song.thumbnail
                }));

            return {
                items,
                total: totalItems,
                page,
                pageSize: options.pageSize,
                totalPages
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get paginated music history for a user across all shared guilds
     * @param userId - Discord user ID
     * @param options - Enhanced pagination parameters with sorting
     * @returns Promise with paginated music history or null
     */
    public async getUserGuildsHistory(
        userId: string,
        options: PaginationParams = {
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortDirection: 'desc'
        }
    ): Promise<PaginatedResponse<MusicHistoryWithGuildDto> | null> {
        try {
            const guilds = this.client.guilds.cache.filter(guild => {
                return guild.members.cache.has(userId) && guild.members.me;
            });
            const guildIds = guilds.map(guild => guild.id);

            if (guildIds.length === 0) {
                return null;
            }

            const MusicDB = require('../../../../utils/music/music_db').default;
            const allSongs: Array<MusicDBSong & { guildId: string; guildName: string }> = [];
            for (const guildId of guildIds) {
                const history = await MusicDB.getGuildMusicHistory(guildId);
                if (history && history.songs && history.songs.length > 0) {
                    const guildSongs = history.songs.map((song: MusicDBSong) => {
                        return {
                            title: song.title,
                            author: song.author,
                            sourceName: song.sourceName,
                            uri: song.uri,
                            played_number: song.played_number,
                            timestamp: song.timestamp,
                            artworkUrl: song.artworkUrl || song.thumbnail,
                            guildId: guildId,
                            guildName: guilds.get(guildId)?.name || 'Unknown Guild'
                        };
                    });

                    allSongs.push(...guildSongs);
                }
            }

            if (allSongs.length === 0) {
                return null;
            }

            const sortBy = options.sortBy || 'timestamp';
            const sortDirection = options.sortDirection || 'desc';
            const sortedSongs = [...allSongs].sort((a, b) => {
                if (sortBy === 'timestamp') {
                    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
                } else {
                    return sortDirection === 'desc'
                        ? (b.played_number || 0) - (a.played_number || 0)
                        : (a.played_number || 0) - (b.played_number || 0);
                }
            });

            const totalItems = sortedSongs.length;
            const totalPages = Math.ceil(totalItems / options.pageSize);
            const page = Math.min(Math.max(options.page, 1), totalPages || 1);
            const startIndex = (page - 1) * options.pageSize;
            const endIndex = Math.min(startIndex + options.pageSize, totalItems);
            const items = sortedSongs
                .slice(startIndex, endIndex)
                .map(song => ({
                    title: song.title,
                    author: song.author,
                    sourceName: song.sourceName,
                    uri: song.uri,
                    played_number: song.played_number,
                    timestamp: song.timestamp,
                    artworkUrl: song.artworkUrl || song.thumbnail,
                    guildId: song.guildId,
                    guildName: song.guildName
                }));

            return {
                items,
                total: totalItems,
                page,
                pageSize: options.pageSize,
                totalPages
            };
        } catch (error) {
            this.client.logger.error(`[MUSIC_SERVICE] Error getting user guilds history: ${error}`);
            throw error;
        }
    }

    /**
     * Get paginated top songs for a user with sorting options
     * @param userId - Discord user ID
     * @param options - Enhanced pagination parameters with sorting
     * @returns Promise with paginated top songs or null if no history found
     */
    public async getUserTopSongs(
        userId: string,
        options: PaginationParams = {
            page: 1,
            pageSize: 10,
            sortBy: 'playCount',
            sortDirection: 'desc'
        }
    ): Promise<PaginatedResponse<MusicHistoryDto> | null> {
        try {
            const MusicDB = require('../../../../utils/music/music_db').default;
            const history = await MusicDB.getUserMusicHistory(userId);

            if (!history || !history.songs || history.songs.length === 0) {
                return null;
            }

            const sortBy = options.sortBy || 'playCount';
            const sortDirection = options.sortDirection || 'desc';
            const sortedSongs = [...history.songs].sort((a: MusicDBSong, b: MusicDBSong) => {
                if (sortBy === 'timestamp') {
                    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
                } else {
                    return sortDirection === 'desc'
                        ? (b.played_number || 0) - (a.played_number || 0)
                        : (a.played_number || 0) - (b.played_number || 0);
                }
            });

            const totalItems = sortedSongs.length;
            const totalPages = Math.ceil(totalItems / options.pageSize);
            const page = Math.min(Math.max(options.page, 1), totalPages || 1);
            const startIndex = (page - 1) * options.pageSize;
            const endIndex = Math.min(startIndex + options.pageSize, totalItems);
            const items = sortedSongs
                .slice(startIndex, endIndex)
                .map((song: MusicDBSong) => ({
                    title: song.title,
                    author: song.author,
                    sourceName: song.sourceName,
                    uri: song.uri,
                    played_number: song.played_number,
                    timestamp: song.timestamp,
                    artworkUrl: song.artworkUrl || song.thumbnail
                }));

            return {
                items,
                total: totalItems,
                page,
                pageSize: options.pageSize,
                totalPages
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get music recommendations based on a user's top song
     * @param userId - Discord user ID
     * @param guildId - Discord guild ID
     * @param count - Number of recommendations to fetch (default is 10)
     * @returns Promise with recommendations or null if no seed song found
     */
    public async getRecommendations(userId: string, guildId: string, count: number = 10): Promise<any> {
        try {
            const PlaylistSuggestion = require('../../../../utils/music/playlist_suggestion').default;
            const suggestionEngine = new PlaylistSuggestion(this.client);
            const recommendations = await suggestionEngine.getSuggestionsFromUserTopSong(
                userId,
                guildId,
                count
            );

            if (!recommendations.seedSong) {
                return null;
            }

            return {
                seedSong: {
                    title: recommendations.seedSong.title,
                    author: recommendations.seedSong.author,
                    uri: recommendations.seedSong.uri,
                    artworkUrl: recommendations.seedSong.artworkUrl || recommendations.seedSong.thumbnail
                },
                recommendations: recommendations.recommendations.map((track: magmastream.Track) => ({
                    title: track.title,
                    author: track.author,
                    uri: track.uri,
                    sourceName: track.sourceName,
                    artworkUrl: track.artworkUrl || track.thumbnail
                }))
            };
        } catch (error) {
            throw error;
        }
    }
}

export default MusicService;