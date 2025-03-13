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
     * @api {get} /api/commands Get all commands
     * @apiName GetAllCommands
     * @apiGroup Commands
     * @apiDescription Get all available commands (both slash and message-based)
     *
     * @apiSuccess {String} status Success status
     * @apiSuccess {String} timestamp ISO timestamp
     * @apiSuccess {Number} count Total number of commands
     * @apiSuccess {Object} data Command data
     * @apiSuccess {Array} data.slash Array of slash commands
     * @apiSuccess {Array} data.message Array of message commands
     */
    router.get('/', controller.getAllCommands);

    /**
     * @api {get} /api/commands/slash Get slash commands
     * @apiName GetSlashCommands
     * @apiGroup Commands
     * @apiDescription Get all slash commands
     *
     * @apiSuccess {String} status Success status
     * @apiSuccess {String} timestamp ISO timestamp
     * @apiSuccess {Number} count Number of slash commands
     * @apiSuccess {Array} data Array of slash commands
     */
    router.get('/slash', controller.getSlashCommands);

    /**
     * @api {get} /api/commands/message Get message commands
     * @apiName GetMessageCommands
     * @apiGroup Commands
     * @apiDescription Get all message-based commands
     *
     * @apiSuccess {String} status Success status
     * @apiSuccess {String} timestamp ISO timestamp
     * @apiSuccess {Number} count Number of message commands
     * @apiSuccess {Array} data Array of message commands
     */
    router.get('/message', controller.getMessageCommands);

    /**
     * @api {get} /api/commands/:name Get command by name
     * @apiName GetCommandByName
     * @apiGroup Commands
     * @apiDescription Get a specific command by name
     *
     * @apiParam {String} name Command name
     * @apiParam {String} [type=SLASH] Command type (SLASH or MESSAGE)
     *
     * @apiSuccess {String} status Success status
     * @apiSuccess {String} timestamp ISO timestamp
     * @apiSuccess {Object} data Command data
     *
     * @apiError {String} status Error status
     * @apiError {String} message Error message
     */
    router.get('/:name', controller.getCommandByName);

    return router;
};

module.exports = commandsRouter;