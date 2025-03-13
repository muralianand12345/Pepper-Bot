import express from 'express';
import discord from 'discord.js';
import HealthController from '../controllers/health-controller';

const healthRouter = (client: discord.Client): express.Router => {
    const router = express.Router();
    const controller = new HealthController(client);

    /**
     * @swagger
     * /health:
     *   get:
     *     summary: API health check
     *     description: Checks if the API is healthy and returns basic system info
     *     tags: [Health]
     *     responses:
     *       200:
     *         description: API is healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/HealthResponse'
     */
    router.get('/', controller.getApiHealth);

    /**
     * @swagger
     * /health/discord:
     *   get:
     *     summary: Discord connection health check
     *     description: Checks if the bot is properly connected to Discord
     *     tags: [Health]
     *     responses:
     *       200:
     *         description: Discord connection is healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/DiscordHealthResponse'
     *       503:
     *         description: Discord connection is not healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/discord', controller.getDiscordHealth);

    return router;
};

export default healthRouter;