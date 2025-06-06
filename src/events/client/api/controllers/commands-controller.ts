import express from 'express';
import discord from 'discord.js';
import CommandService from '../services/command-service';
import { CommandsResponseDto } from '../dto/commands-dto';

class CommandsController {
    private readonly client: discord.Client;
    private readonly commandService: CommandService;

    constructor(client: discord.Client) {
        this.client = client;
        this.commandService = new CommandService(client);
    }

    public getAllCommands = (req: express.Request, res: express.Response): void => {
        const slashCommands = this.commandService.getSlashCommands();
        const messageCommands = this.commandService.getMessageCommands();

        const response: CommandsResponseDto = {
            status: 'success',
            timestamp: new Date().toISOString(),
            count: slashCommands.length + messageCommands.length,
            data: {
                slash: slashCommands,
                message: messageCommands
            }
        };

        res.json(response);
    };

    public getSlashCommands = (req: express.Request, res: express.Response): void => {
        const commands = this.commandService.getSlashCommands();

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            count: commands.length,
            data: commands
        });
    };

    public getMessageCommands = (req: express.Request, res: express.Response): void => {
        const commands = this.commandService.getMessageCommands();

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            count: commands.length,
            data: commands
        });
    };

    public getCommandByName = (req: express.Request, res: express.Response): void => {
        const { name } = req.params;
        const type = (req.query.type as string || 'SLASH').toUpperCase() as 'SLASH' | 'MESSAGE';

        if (!name) {
            res.status(400).json({
                status: 'error',
                message: 'Command name is required'
            });
            return;
        }

        const command = this.commandService.getCommandByName(name, type);

        if (!command) {
            res.status(404).json({
                status: 'error',
                message: `Command '${name}' of type '${type}' not found`
            });
            return;
        }

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            data: command
        });
    };
}

export default CommandsController;