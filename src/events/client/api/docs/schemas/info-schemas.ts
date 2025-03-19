/**
 * @swagger
 * components:
 *   schemas:
 *     BotStatsResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: healthy
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: '1234567890'
 *               description: Bot Discord ID
 *             name:
 *               type: string
 *               example: 'MyBot'
 *               description: Bot username
 *             uptime:
 *               type: number
 *               example: 1234567890
 *               description: Bot uptime in milliseconds
 *             players:
 *               type: integer
 *               example: 1
 *               description: Number of active players
 *             guilds:
 *               type: integer
 *               example: 1
 *               description: Number of servers the bot is in
 *             users:
 *               type: integer
 *               example: 1
 *               description: Approximate number of users the bot can see
 */