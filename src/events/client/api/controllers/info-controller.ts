import express from 'express';
import discord from 'discord.js';
import InfoService from '../services/info-service';

class InfoController {
    private readonly infoService: InfoService;

    constructor(client: discord.Client) {
        this.infoService = new InfoService(client);
    }

    public getBotStats = (req: express.Request, res: express.Response): void => {
        const stats = this.infoService.getBotStats();

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            data: stats
        });
    };
}

export default InfoController;