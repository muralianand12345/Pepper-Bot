import express from 'express';
import discord from 'discord.js';
import MusicController from '../controllers/music-controller';
import path from 'path';

const musicRouter = (client: discord.Client): express.Router => {
    const router = express.Router();
    const controller = new MusicController(client);

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
     *               $ref: '#/components/schemas/PlayersResponse'
     */
    router.get('/players', controller.getAllPlayers);

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
     *               $ref: '#/components/schemas/DetailedPlayerResponse'
     *       404:
     *         description: Player not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/players/:guildId', controller.getPlayerById);

    /**
     * @swagger
     * /music/history/guild/{guildId}:
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
     *               $ref: '#/components/schemas/MusicHistoryResponse'
     */
    router.get('/history/guild/:guildId', controller.getGuildMusicHistory);

    /**
     * @swagger
     * /music/history/user/{userId}:
     *   get:
     *     summary: Get music history for a user
     *     description: Retrieves the music playback history for a specific user
     *     tags: [Music]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *         description: Discord user ID
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
     *               $ref: '#/components/schemas/MusicHistoryResponse'
     */
    router.get('/history/user/:userId', controller.getUserMusicHistory);

    /**
     * @swagger
     * /music/recommendations/{userId}/{guildId}:
     *   get:
     *     summary: Get music recommendations
     *     description: Retrieves personalized music recommendations based on user's listening history
     *     tags: [Music]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *         description: Discord user ID
     *       - in: path
     *         name: guildId
     *         required: true
     *         schema:
     *           type: string
     *         description: Discord guild ID
     *       - in: query
     *         name: count
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of recommendations to retrieve
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
     *                     seedSong:
     *                       type: object
     *                       properties:
     *                         title:
     *                           type: string
     *                         author:
     *                           type: string
     *                         uri:
     *                           type: string
     *                         artworkUrl:
     *                           type: string
     *                     recommendations:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           title:
     *                             type: string
     *                           author:
     *                             type: string
     *                           uri:
     *                             type: string
     *                           sourceName:
     *                             type: string
     *                           artworkUrl:
     *                             type: string
     *       404:
     *         description: No listening history found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/recommendations/:userId/:guildId', controller.getRecommendations);

    return router;
};

export default musicRouter;