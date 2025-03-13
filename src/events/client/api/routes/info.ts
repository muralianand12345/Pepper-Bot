import express from 'express';
import discord from 'discord.js';

/**
 * Create and configure routes for bot info API
 * @param client - Discord client
 * @returns Configured router
 */
const infoRouter = (client: discord.Client): express.Router => {
    const router = express.Router();

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
     *                     name:
     *                       type: string
     *                       description: Bot username
     *                     id:
     *                       type: string
     *                       description: Bot Discord ID
     *                     uptime:
     *                       type: number
     *                       description: Bot uptime in milliseconds
     *                     guilds:
     *                       type: integer
     *                       description: Number of servers the bot is in
     *                     users:
     *                       type: integer
     *                       description: Approximate number of users the bot can see
     *                     version:
     *                       type: string
     *                       description: Bot version
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/', (req, res) => {
        const { user, uptime, guilds } = client;

        if (!user) {
            return res.status(500).json({
                status: 'error',
                message: 'Bot client user is not available'
            });
        }

        // Calculate total users across all guilds
        const totalUsers = guilds.cache.reduce((acc, guild) =>
            acc + (guild.memberCount || 0), 0);

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            data: {
                name: user.username,
                id: user.id,
                uptime: uptime,
                guilds: guilds.cache.size,
                users: totalUsers,
                version: process.env.npm_package_version || '1.0.0'
            }
        });
    });

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
     *                     players:
     *                       type: integer
     *                       description: Number of active music players
     *                     guilds:
     *                       type: integer
     *                       description: Number of servers
     *                     commandsExecuted:
     *                       type: integer
     *                       description: Estimated total commands executed since restart
     *                     memoryUsage:
     *                       type: object
     *                       properties:
     *                         rss:
     *                           type: number
     *                           description: Resident set size memory usage in MB
     *                         heapTotal:
     *                           type: number
     *                           description: Total heap size in MB
     *                         heapUsed:
     *                           type: number
     *                           description: Used heap size in MB
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/stats', (req, res) => {
        // Memory usage statistics
        const memUsage = process.memoryUsage();

        // Get number of active players
        const activePlayers = client.manager?.players?.size || 0;

        // Simple command execution estimation
        // In a production system, you would track this in a database
        const commandsExecuted = 0; // This would need to be tracked elsewhere

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            data: {
                players: activePlayers,
                guilds: client.guilds.cache.size,
                commandsExecuted,
                memoryUsage: {
                    rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
                }
            }
        });
    });

    return router;
};

export default infoRouter;