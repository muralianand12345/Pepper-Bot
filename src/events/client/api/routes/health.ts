import express from 'express';
import discord from 'discord.js';
import os from 'os';

/**
 * Create and configure routes for health check API
 * @param client - Discord client
 * @returns Configured router
 */
const healthRouter = (client: discord.Client): express.Router => {
    const router = express.Router();
    let startTime = Date.now();

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
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: healthy
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                 uptime:
     *                   type: number
     *                   description: API uptime in seconds
     *                 system:
     *                   type: object
     *                   properties:
     *                     platform:
     *                       type: string
     *                     cpuLoad:
     *                       type: number
     *                     memoryUsage:
     *                       type: number
     *                       description: Memory usage percentage
     *                     nodeVersion:
     *                       type: string
     */
    router.get('/', (req, res) => {
        // Calculate API uptime
        const uptime = Math.floor((Date.now() - startTime) / 1000);

        // Get system information
        const cpuLoad = os.loadavg()[0];
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = parseFloat(((1 - freeMem / totalMem) * 100).toFixed(2));

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime,
            system: {
                platform: os.platform(),
                cpuLoad,
                memoryUsage,
                nodeVersion: process.version
            }
        });
    });

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
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: connected
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                 ping:
     *                   type: number
     *                   description: Discord WebSocket ping in ms
     *                 shards:
     *                   type: object
     *                   properties:
     *                     total:
     *                       type: integer
     *                     status:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           id:
     *                             type: integer
     *                           status:
     *                             type: string
     *       503:
     *         description: Discord connection is not healthy
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/discord', (req, res) => {
        // Check Discord connection status
        if (!client.user || !client.ws.shards.size) {
            return res.status(503).json({
                status: 'error',
                message: 'Discord connection unavailable'
            });
        }

        // Get shard statuses for more detailed health info
        const shardStatuses = Array.from(client.ws.shards.values()).map(shard => ({
            id: shard.id,
            status: shard.status
        }));

        res.json({
            status: 'connected',
            timestamp: new Date().toISOString(),
            ping: client.ws.ping,
            shards: {
                total: client.ws.shards.size,
                status: shardStatuses
            }
        });
    });

    return router;
};

export default healthRouter;