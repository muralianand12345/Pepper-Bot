import express from 'express';
import discord from 'discord.js';
import swaggerUi from 'swagger-ui-express';
import ApiConfig from './api-config';
import Logger from '../../../../utils/logger';
import { ILogger } from '../../../../types';
import swaggerSpec from '../docs/swagger-config';

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
        // Swagger documentation route
        this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            explorer: true,
            customSiteTitle: 'Pepper Bot API Documentation',
            customCss: '.swagger-ui .topbar { display: none }',
            swaggerOptions: {
                persistAuthorization: true,
                docExpansion: 'none',
                filter: true,
            }
        }));

        // JSON endpoint for Swagger specification 
        this.app.get('/docs.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });

        // Load routes
        const commandRoutes = require('../routes/commands').default;
        const infoRoutes = require('../routes/info').default;
        const healthRoutes = require('../routes/health').default;
        const musicRoutes = require('../routes/music').default;

        // Map routes to endpoints
        this.app.use('/api/commands', commandRoutes(this.client));
        this.app.use('/api/info', infoRoutes(this.client));
        this.app.use('/api/health', healthRoutes(this.client));
        this.app.use('/api/music', musicRoutes(this.client));

        // Root route for API status
        /**
         * @swagger
         * /:
         *   get:
         *     summary: API Status
         *     description: Check if the API is online
         *     tags: [Status]
         *     responses:
         *       200:
         *         description: API is online
         *         content:
         *           application/json:
         *             schema:
         *               type: object
         *               properties:
         *                 status:
         *                   type: string
         *                   example: online
         *                 timestamp:
         *                   type: string
         *                   format: date-time
         *                 version:
         *                   type: string
         *                 endpoints:
         *                   type: array
         *                   items:
         *                     type: string
         *                   description: Available endpoint groups
         */
        this.app.get('/api', (req, res) => {
            const version = process.env.npm_package_version || '1.0.0';
            res.json({
                status: 'online',
                timestamp: new Date().toISOString(),
                version: version,
                endpoints: [
                    '/api/commands',
                    '/api/info',
                    '/api/health',
                    '/docs'
                ],
                documentation: '/docs'
            });
        });

        // Swagger documentation route
        this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            explorer: true,
            customSiteTitle: 'Pepper Bot API Documentation',
            customCss: `
                .swagger-ui .topbar { display: none }
                .swagger-ui .info .title { color: #2B2D31 }
                .swagger-ui .scheme-container { background-color: #f8f9fa }
                .swagger-ui .info { margin: 30px 0 }
                .swagger-ui .btn.authorize { background-color: #5865F2 }
                .swagger-ui .btn.authorize svg { fill: #fff }
            `,
            swaggerOptions: {
                persistAuthorization: true,
                docExpansion: 'none',
                filter: true,
                tagsSorter: 'alpha',
                operationsSorter: 'alpha'
            }
        }))

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                status: 'error',
                message: 'Endpoint not found'
            });
        });

        // Error handler
        this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            this.logger.error(`API Error: ${err.message}`);
            res.status(500).json({
                status: 'error',
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
            this.logger.info(`[API] Swagger documentation available at http://localhost:${port}/docs`);
        });
    }
}

export default ApiServer;