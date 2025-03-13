import express from 'express';
import discord from 'discord.js';

/**
 * Create and configure routes for music control API
 * @param client - Discord client
 * @returns Configured router
 */
const musicRouter = (client: discord.Client): express.Router => {
    const router = express.Router();

    /**
     * @swagger
     * /music/players:
     *   get:
     *     summary: Get all active music players
     *     description: Retrieves information about all currently active music players
     *     tags: [Music]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Successful operation
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: success
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                 count:
     *                   type: integer
     *                   description: Number of active players
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       guildId:
     *                         type: string
     *                       guildName:
     *                         type: string
     *                       playing:
     *                         type: boolean
     *                       paused:
     *                         type: boolean
     *                       volume:
     *                         type: integer
     *                       currentTrack:
     *                         type: object
     *                         properties:
     *                           title:
     *                             type: string
     *                           author:
     *                             type: string
     *                           duration:
     *                             type: integer
     *                           position:
     *                             type: integer
     *                           uri:
     *                             type: string
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/players', (req, res) => {
        if (!client.manager) {
            return res.status(500).json({
                status: 'error',
                message: 'Music manager is not initialized'
            });
        }

        const players = client.manager.players;

        // Transform players into a more API-friendly format
        const playerData = Array.from(players.values()).map(player => {
            const guild = client.guilds.cache.get(player.guildId);

            // Get current track information
            const currentTrack = player.queue.current ? {
                title: player.queue.current.title,
                author: player.queue.current.author,
                duration: player.queue.current.duration,
                position: player.position,
                uri: player.queue.current.uri,
                sourceName: player.queue.current.sourceName
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

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            count: playerData.length,
            data: playerData
        });
    });

    /**
     * @swagger
     * /music/players/{guildId}:
     *   get:
     *     summary: Get player information for a specific guild
     *     description: Retrieves detailed information about a music player in a specific guild
     *     tags: [Music]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: guildId
     *         required: true
     *         schema:
     *           type: string
     *         description: Discord guild ID
     *     responses:
     *       200:
     *         description: Successful operation
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: success
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                 data:
     *                   type: object
     *                   properties:
     *                     guildId:
     *                       type: string
     *                     guildName:
     *                       type: string
     *                     playing:
     *                       type: boolean
     *                     paused:
     *                       type: boolean
     *                     volume:
     *                       type: integer
     *                     currentTrack:
     *                       type: object
     *                       properties:
     *                         title:
     *                           type: string
     *                         author:
     *                           type: string
     *                         duration:
     *                           type: integer
     *                         position:
     *                           type: integer
     *                         uri:
     *                           type: string
     *                     queue:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           title:
     *                             type: string
     *                           author:
     *                             type: string
     *                           duration:
     *                             type: integer
     *                           uri:
     *                             type: string
     *       404:
     *         description: Player not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/players/:guildId', (req, res) => {
        const { guildId } = req.params;

        if (!client.manager) {
            return res.status(500).json({
                status: 'error',
                message: 'Music manager is not initialized'
            });
        }

        // Get the player for the specified guild
        const player = client.manager.get(guildId);

        if (!player) {
            return res.status(404).json({
                status: 'error',
                message: 'No active player found for this guild'
            });
        }

        const guild = client.guilds.cache.get(guildId);

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

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            data: {
                guildId: player.guildId,
                guildName: guild ? guild.name : 'Unknown',
                playing: player.playing,
                paused: player.paused,
                volume: player.volume,
                trackRepeat: player.trackRepeat,
                queueRepeat: player.queueRepeat,
                currentTrack,
                queue
            }
        });
    });

    /**
     * @swagger
     * /music/history/{guildId}:
     *   get:
     *     summary: Get music history for a guild
     *     description: Retrieves the music playback history for a specific guild
     *     tags: [Music]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: guildId
     *         required: true
     *         schema:
     *           type: string
     *         description: Discord guild ID
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of tracks to retrieve
     *     responses:
     *       200:
     *         description: Successful operation
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: success
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                 count:
     *                   type: integer
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       title:
     *                         type: string
     *                       author:
     *                         type: string
     *                       sourceName:
     *                         type: string
     *                       playCount:
     *                         type: integer
     *                       lastPlayed:
     *                         type: string
     *                         format: date-time
     *       404:
     *         description: No history found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/history/:guildId', async (req, res) => {
        const { guildId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;

        try {
            // Use MusicDB utility to get guild history
            const MusicDB = require('../../../../utils/music/music_db').default;
            const history = await MusicDB.getGuildMusicHistory(guildId);

            if (!history || !history.songs || history.songs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'No music history found for this guild'
                });
            }

            // Format history data for API response
            const formattedHistory = history.songs
                .sort((a, b) => b.played_number - a.played_number)
                .slice(0, limit)
                .map(song => ({
                    title: song.title,
                    author: song.author,
                    sourceName: song.sourceName,
                    uri: song.uri,
                    playCount: song.played_number,
                    lastPlayed: song.timestamp,
                    artworkUrl: song.artworkUrl || song.thumbnail
                }));

            res.json({
                status: 'success',
                timestamp: new Date().toISOString(),
                count: formattedHistory.length,
                data: formattedHistory
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve music history',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    return router;
};

export default musicRouter;