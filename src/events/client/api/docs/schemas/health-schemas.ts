/**
 * @swagger
 * components:
 *   schemas:
 *     HealthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: healthy
 *         timestamp:
 *           type: string
 *           format: date-time
 *         uptime:
 *           type: integer
 *           description: API uptime in seconds
 *         system:
 *           type: object
 *           properties:
 *             platform:
 *               type: string
 *             cpuLoad:
 *               type: number
 *             memoryUsage:
 *               type: number
 *               description: Memory usage percentage
 *             nodeVersion:
 *               type: string
 * 
 *     DiscordHealthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: connected
 *         timestamp:
 *           type: string
 *           format: date-time
 *         ping:
 *           type: number
 *           description: Discord WebSocket ping in ms
 *         shards:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             status:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   status:
 *                     type: string
 */