import express from 'express';
import discord from 'discord.js';
import MusicService from '../services/music-service';

class MusicController {
    private readonly musicService: MusicService;

    constructor(client: discord.Client) {
        this.musicService = new MusicService(client);
    }

    public getAllPlayers = (req: express.Request, res: express.Response): void => {
        try {
            const playerData = this.musicService.getAllPlayers();

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                count: playerData.length,
                data: playerData
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve player data',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    };

    public getPlayerById = (req: express.Request, res: express.Response): void => {
        const { guildId } = req.params;

        try {
            const player = this.musicService.getPlayerById(guildId);

            if (!player) {
                res.status(404).json({
                    status: 'error',
                    message: 'No active player found for this guild'
                });
                return;
            }

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                data: player
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve player data',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    };

    public getGuildMusicHistory = async (req: express.Request, res: express.Response): Promise<void> => {
        const { guildId } = req.params;

        // Extract pagination and sorting parameters from query
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const sortBy = (req.query.sortBy as 'timestamp' | 'playCount') || 'timestamp';
        const sortDirection = (req.query.sortDirection as 'desc' | 'asc') || 'desc';

        try {
            const history = await this.musicService.getGuildMusicHistory(guildId, {
                page,
                pageSize,
                sortBy,
                sortDirection
            });

            if (!history) {
                res.status(404).json({
                    status: 'error',
                    message: 'No music history found for this guild'
                });
                return;
            }

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                pagination: {
                    page: history.page,
                    pageSize: history.pageSize,
                    total: history.total,
                    totalPages: history.totalPages
                },
                sort: {
                    by: sortBy,
                    direction: sortDirection
                },
                data: history.items
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve music history',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    };

    public getUserMusicHistory = async (req: express.Request, res: express.Response): Promise<void> => {
        const { userId } = req.params;

        // Extract pagination and sorting parameters from query
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const sortBy = (req.query.sortBy as 'timestamp' | 'playCount') || 'timestamp';
        const sortDirection = (req.query.sortDirection as 'desc' | 'asc') || 'desc';

        try {
            const history = await this.musicService.getUserMusicHistory(userId, {
                page,
                pageSize,
                sortBy,
                sortDirection
            });

            if (!history) {
                res.status(404).json({
                    status: 'error',
                    message: 'No music history found for this user'
                });
                return;
            }

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                pagination: {
                    page: history.page,
                    pageSize: history.pageSize,
                    total: history.total,
                    totalPages: history.totalPages
                },
                sort: {
                    by: sortBy,
                    direction: sortDirection
                },
                data: history.items
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve music history',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    };

    public getUserGuildsHistory = async (req: express.Request, res: express.Response): Promise<void> => {
        const { userId } = req.params;

        // Extract pagination and sorting parameters from query
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const sortBy = (req.query.sortBy as 'timestamp' | 'playCount') || 'timestamp';
        const sortDirection = (req.query.sortDirection as 'desc' | 'asc') || 'desc';

        try {
            const history = await this.musicService.getUserGuildsHistory(userId, {
                page,
                pageSize,
                sortBy,
                sortDirection
            });

            if (!history) {
                res.status(404).json({
                    status: 'error',
                    message: 'No music history found for this user across any guilds'
                });
                return;
            }

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                pagination: {
                    page: history.page,
                    pageSize: history.pageSize,
                    total: history.total,
                    totalPages: history.totalPages
                },
                sort: {
                    by: sortBy,
                    direction: sortDirection
                },
                data: history.items
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve music history across guilds',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    };

    public getUserTopSongs = async (req: express.Request, res: express.Response): Promise<void> => {
        const { userId } = req.params;

        // Extract pagination and sorting parameters from query
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const sortBy = (req.query.sortBy as 'timestamp' | 'playCount') || 'playCount';
        const sortDirection = (req.query.sortDirection as 'desc' | 'asc') || 'desc';

        try {
            const topSongs = await this.musicService.getUserTopSongs(userId, {
                page,
                pageSize,
                sortBy,
                sortDirection
            });

            if (!topSongs) {
                res.status(404).json({
                    status: 'error',
                    message: 'No music history found for this user'
                });
                return;
            }

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                pagination: {
                    page: topSongs.page,
                    pageSize: topSongs.pageSize,
                    total: topSongs.total,
                    totalPages: topSongs.totalPages
                },
                sort: {
                    by: sortBy,
                    direction: sortDirection
                },
                data: topSongs.items
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve top songs',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    };

    public getRecommendations = async (req: express.Request, res: express.Response): Promise<void> => {
        const { userId, guildId } = req.params;
        const count = parseInt(req.query.count as string) || 10;

        try {
            const recommendations = await this.musicService.getRecommendations(userId, guildId, count);

            if (!recommendations) {
                res.status(404).json({
                    status: 'error',
                    message: 'No listening history found for recommendation generation'
                });
                return;
            }

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                data: recommendations
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to generate recommendations',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    };
}

export default MusicController;