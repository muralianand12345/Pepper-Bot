import express from 'express';
import discord from 'discord.js';
import InfoController from '../controllers/info-controller';

const infoRouter = (client: discord.Client): express.Router => {
    const router = express.Router();
    const controller = new InfoController(client);

    /**
     * @swagger
     * /info:
     *   get:
     *     summary: Get bot information
     *     description: Retrieves general information about the bot
     *     tags: [Bot Info]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Successful operation
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/BotInfoResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/', controller.getBotInfo);

    /**
     * @swagger
     * /info/stats:
     *   get:
     *     summary: Get bot statistics
     *     description: Retrieves detailed statistics about the bot's usage
     *     tags: [Bot Info]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Successful operation
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/BotStatsResponse'
     */
    router.get('/stats', controller.getBotStats);

    return router;
};

export default infoRouter;