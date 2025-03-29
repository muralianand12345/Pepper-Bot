import express from 'express';
import discord from 'discord.js';
import MusicController from '../controllers/music-controller';

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
     *               $ref: '#/components/schemas/PlayerResponse'
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
     *     description: Retrieves the music playback history for a specific guild with pagination and sorting options
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
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *           enum: [timestamp, playCount]
     *           default: timestamp
     *         description: Field to sort by (timestamp for newest/oldest or playCount for most/least played)
     *       - in: query
     *         name: sortDirection
     *         schema:
     *           type: string
     *           enum: [desc, asc]
     *           default: desc
     *         description: Sort direction (desc for newest first or most played, asc for oldest first or least played)
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
     *                 pagination:
     *                   type: object
     *                   properties:
     *                     page:
     *                       type: integer
     *                     pageSize:
     *                       type: integer
     *                     total:
     *                       type: integer
     *                     totalPages:
     *                       type: integer
     *                 sort:
     *                   type: object
     *                   properties:
     *                     by:
     *                       type: string
     *                       enum: [timestamp, playCount]
     *                     direction:
     *                       type: string
     *                       enum: [desc, asc]
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/MusicHistoryDto'
     *       404:
     *         description: No music history found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/history/guild/:guildId', controller.getGuildMusicHistory);

    /**
     * @swagger
     * /music/history/user/{userId}:
     *   get:
     *     summary: Get music history for a user
     *     description: Retrieves the music playback history for a specific user with pagination and sorting options
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
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *           enum: [timestamp, playCount]
     *           default: timestamp
     *         description: Field to sort by (timestamp for newest/oldest or playCount for most/least played)
     *       - in: query
     *         name: sortDirection
     *         schema:
     *           type: string
     *           enum: [desc, asc]
     *           default: desc
     *         description: Sort direction (desc for newest first or most played, asc for oldest first or least played)
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
     *                 pagination:
     *                   type: object
     *                   properties:
     *                     page:
     *                       type: integer
     *                     pageSize:
     *                       type: integer
     *                     total:
     *                       type: integer
     *                     totalPages:
     *                       type: integer
     *                 sort:
     *                   type: object
     *                   properties:
     *                     by:
     *                       type: string
     *                       enum: [timestamp, playCount]
     *                     direction:
     *                       type: string
     *                       enum: [desc, asc]
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/MusicHistoryDto'
     *       404:
     *         description: No music history found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/history/user/:userId', controller.getUserMusicHistory);

    /**
     * @swagger
     * /music/topsongs/{userId}:
     *   get:
     *     summary: Get top songs for a user
     *     description: Retrieves the most played songs for a specific user
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
     *         description: Number of top songs to retrieve
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
     *                     $ref: '#/components/schemas/MusicHistoryDto'
     *       404:
     *         description: No music history found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/topsongs/:userId', controller.getUserTopSongs);

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
     *               $ref: '#/components/schemas/RecommendationResponse'
     *       404:
     *         description: No listening history found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/recommendations/:userId/:guildId', controller.getRecommendations);

    return router;
};

export default musicRouter;