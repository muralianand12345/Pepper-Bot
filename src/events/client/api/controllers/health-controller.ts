import express from 'express';
import discord from 'discord.js';
import HealthService from '../services/health-service';

class HealthController {
    private readonly healthService: HealthService;

    constructor(client: discord.Client) {
        this.healthService = new HealthService(client);
    }

    public getApiHealth = (req: express.Request, res: express.Response): void => {
        const healthData = this.healthService.getApiHealth();
        res.json(healthData);
    };

    public getDiscordHealth = (req: express.Request, res: express.Response): void => {
        const discordHealth = this.healthService.getDiscordHealth();

        if (!discordHealth) {
            res.status(503).json({
                status: 'error',
                message: 'Discord connection unavailable'
            });
            return;
        }

        res.json(discordHealth);
    };
}

export default HealthController;