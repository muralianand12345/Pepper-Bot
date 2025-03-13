import express from 'express';
import discord from 'discord.js';
import CommandsController from '../controllers/commands-controller';

/**
 * Create and configure routes for commands API
 * @param client - Discord client
 * @returns Configured router
 */
const commandsRouter = (client: discord.Client): express.Router => {
    const router = express.Router();
    const controller = new CommandsController(client);

    /**
     * @swagger
     * /commands:
     *   get:
     *     summary: Get all commands
     *     description: Retrieves all available commands (both slash and message-based)
     *     tags: [Commands]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Successful operation
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/CommandsResponse'
     *       401:
     *         description: Unauthorized - Invalid or missing API key
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
    router.get('/', controller.getAllCommands);

    /**
     * @swagger
     * /commands/slash:
     *   get:
     *     summary: Get slash commands
     *     description: Retrieves all slash commands
     *     tags: [Commands]
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
     *                 count:
     *                   type: integer
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/SlashCommand'
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/slash', controller.getSlashCommands);

    /**
     * @swagger
     * /commands/message:
     *   get:
     *     summary: Get message commands
     *     description: Retrieves all message-based commands
     *     tags: [Commands]
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
     *                 count:
     *                   type: integer
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/MessageCommand'
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/message', controller.getMessageCommands);

    /**
     * @swagger
     * /commands/{name}:
     *   get:
     *     summary: Get command by name
     *     description: Retrieves a specific command by name
     *     tags: [Commands]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: name
     *         required: true
     *         schema:
     *           type: string
     *         description: Command name
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [SLASH, MESSAGE]
     *           default: SLASH
     *         description: Command type
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
     *                   oneOf:
     *                     - $ref: '#/components/schemas/SlashCommand'
     *                     - $ref: '#/components/schemas/MessageCommand'
     *       400:
     *         description: Bad request - Missing command name
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Command not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized - Invalid or missing API key
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.get('/:name', controller.getCommandByName);

    return router;
};

export default commandsRouter;