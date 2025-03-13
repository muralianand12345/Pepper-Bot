/**
 * @swagger
 * components:
 *   schemas:
 *     BotInfoResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: Bot username
 *             id:
 *               type: string
 *               description: Bot Discord ID
 *             uptime:
 *               type: number
 *               description: Bot uptime in milliseconds
 *             guilds:
 *               type: integer
 *               description: Number of servers the bot is in
 *             users:
 *               type: integer
 *               description: Approximate number of users the bot can see
 *             version:
 *               type: string
 *               description: Bot version
 *
 *     BotStatsResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             players:
 *               type: integer
 *               description: Number of active music players
 *             guilds:
 *               type: integer
 *               description: Number of servers
 *             commandsExecuted:
 *               type: integer
 *               description: Estimated total commands executed since restart
 *             memoryUsage:
 *               type: object
 *               properties:
 *                 rss:
 *                   type: number
 *                   description: Resident set size memory usage in MB
 *                 heapTotal:
 *                   type: number
 *                   description: Total heap size in MB
 *                 heapUsed:
 *                   type: number
 *                   description: Used heap size in MB
 */