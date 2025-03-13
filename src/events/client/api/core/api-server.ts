import express from 'express';
import discord from 'discord.js';
import ApiConfig from './api-config';
import Logger from '../../../../utils/logger';
import { ILogger } from '../../../../types';

/**
 * API Server that provides endpoints to interact with the bot
 */
class ApiServer {
    private readonly app: express.Application;
    private readonly client: discord.Client;
    private readonly logger: ILogger;
    private readonly apiConfig: ApiConfig;

    /**
     * Create a new API server
     * @param client - Discord client
     */
    constructor(client: discord.Client) {
        this.client = client;
        this.app = express();
        this.logger = new Logger();
        this.apiConfig = ApiConfig.getInstance(client.config);

        // Configure express app
        this.apiConfig.configureApp(this.app);

        // Register routes
        this.registerRoutes();
    }

    /**
     * Register API routes
     */
    private registerRoutes(): void {
        // Load routes
        const commandRoutes = require('../routes/commands');

        // Map routes to endpoints
        this.app.use('/api/commands', commandRoutes(this.client));

        // Root route for API status
        this.app.get('/api', (req, res) => {
            res.json({
                status: 'online',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                status: 404,
                message: 'Endpoint not found'
            });
        });

        // Error handler
        this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            this.logger.error(`API Error: ${err.message}`);
            res.status(500).json({
                status: 500,
                message: 'Internal server error'
            });
        });
    }

    /**
     * Start the API server
     */
    public start(): void {
        const port = this.apiConfig.getPort();

        this.app.listen(port, () => {
            this.logger.info(`[API] Server started on port ${port}`);
        });
    }
}

export default ApiServer;