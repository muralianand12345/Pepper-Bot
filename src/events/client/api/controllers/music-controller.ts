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
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;

        try {
            const history = await this.musicService.getGuildMusicHistory(guildId, { page, pageSize });

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
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;

        try {
            const history = await this.musicService.getUserMusicHistory(userId, { page, pageSize });

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

    public getUserTopSongs = async (req: express.Request, res: express.Response): Promise<void> => {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;

        try {
            const topSongs = await this.musicService.getUserTopSongs(userId, limit);

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
                count: topSongs.length,
                data: topSongs
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