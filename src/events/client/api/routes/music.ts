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
     *               $ref: '#/components/schemas/MusicHistoryResponse'
     */
    router.get('/history/:guildId', controller.getGuildMusicHistory);

    return router;
};

export default musicRouter;