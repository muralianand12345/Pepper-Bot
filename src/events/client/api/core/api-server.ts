import http from 'http';
import path from 'path';
import express from 'express';
import discord from 'discord.js';
import ApiConfig from './api-config';
import swaggerUi from 'swagger-ui-express';
import { ILogger } from '../../../../types';
import Logger from '../../../../utils/logger';
import WebSocketManager from './websocket-manager';
import swaggerSpec from '../docs/swagger-config';
import AuthMiddleware from '../middleware/auth-middleware';
import LoggerMiddleware from '../middleware/logger-middleware';
import ApiDiagnostic from '../utils/api-diagnostic';

/**
 * API Server that provides endpoints to interact with the bot
 */
class ApiServer {
    private readonly app: express.Application;
    private readonly client: discord.Client;
    private readonly logger: ILogger;
    private readonly apiConfig: ApiConfig;
    private readonly authMiddleware: AuthMiddleware;
    private readonly loggerMiddleware: LoggerMiddleware;
    private httpServer: http.Server | null = null;

    /**
     * Create a new API server
     * @param client - Discord client
     */
    constructor(client: discord.Client) {
        this.client = client;
        this.app = express();
        this.logger = new Logger();
        this.apiConfig = ApiConfig.getInstance(client.config);
        this.logger = new Logger();


        // Initialize middlewares
        this.authMiddleware = new AuthMiddleware({
            enabled: client.config.api?.auth?.enabled || false,
            apiKey: client.config.api?.auth?.apiKey || ''
        });
        this.loggerMiddleware = new LoggerMiddleware(this.logger);

        // Configure express app
        this.apiConfig.configureApp(this.app);

        // Add request logging middleware
        this.app.use(this.loggerMiddleware.logRequest);

        // Serve static files for Swagger
        this.app.use('/swagger-assets', express.static(path.join(__dirname, '../../../../../static/')));

        // Register routes
        this.registerRoutes();
    }

    /**
     * Register API routes
     */
    private registerRoutes(): void {
        // Swagger documentation route (no auth required)
        this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            explorer: true,
            customSiteTitle: 'Pepper Bot API Documentation',
            customCss: '.swagger-ui .topbar { display: none }',
            swaggerOptions: {
                persistAuthorization: true,
                docExpansion: 'none',
                filter: true,
                tryItOutEnabled: true,
                url: '/docs.json',
            }
        }));

        // JSON endpoint for Swagger specification (no auth required)
        this.app.get('/docs.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });

        //Websocket documentation
        this.app.get('/music/docs', (req, res) => {
            try {
                res.sendFile(path.join(__dirname, '../../../../../static/websocket_ui.html'));
            } catch (error) {
                res.status(500).send('Error loading WebSocket documentation');
            }
        });

        // Root route for API status (no auth required)
        this.app.get('/api', (req, res) => {
            const version = process.env.npm_package_version || '1.0.0';
            res.json({
                status: 'online',
                timestamp: new Date().toISOString(),
                version: version,
                endpoints: [
                    '/api/v1/commands',
                    '/api/v1/info',
                    '/api/v1/health',
                    '/docs'
                ],
                documentation: '/docs'
            });
        });

        // Create API router with authentication middleware
        const apiRouter = express.Router();

        // Apply auth middleware to all API routes except the root
        apiRouter.use(this.authMiddleware.authenticate);

        // Load route modules
        const commandRoutes = require('../routes/commands').default;
        const infoRoutes = require('../routes/info').default;
        const healthRoutes = require('../routes/health').default;
        const musicRoutes = require('../routes/music').default;

        // Register route handlers to the authenticated router
        apiRouter.use('/commands', commandRoutes(this.client));
        apiRouter.use('/info', infoRoutes(this.client));
        apiRouter.use('/health', healthRoutes(this.client));
        apiRouter.use('/music', musicRoutes(this.client));

        // Attach the authenticated router to the app
        this.app.use('/api/v1', apiRouter);

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
        // Run diagnostics first
        const diagnostic = new ApiDiagnostic(this.client, this.logger);
        diagnostic.runDiagnostics();

        const port = this.apiConfig.getPort();

        // Create HTTP server instead of directly using Express
        this.httpServer = http.createServer(this.app);

        // Make the HTTP server available on the client for WebSocket events
        (this.client as any).httpServer = this.httpServer;

        // Initialize WebSocket manager with HTTP server
        WebSocketManager.getInstance(this.client, this.httpServer, this.logger);

        // Start HTTP server
        this.httpServer.listen(port, () => {
            this.logger.info(`[API] Server started on port ${port}`);
            this.logger.info(`[API] Swagger documentation available at http://localhost:${port}/docs`);
            this.logger.info(`[API] WebSocket endpoint available at ws://localhost:${port}/api/v1/music/ws`);

            // Log authentication status
            const authStatus = this.client.config.api?.auth?.enabled
                ? `enabled (key required)`
                : 'disabled (no authentication)';
            this.logger.info(`[API] Authentication is ${authStatus}`);

            if (this.client.config.api?.auth?.enabled) {
                this.logger.info(`[API] API key length: ${this.client.config.api?.auth?.apiKey?.length || 0} characters`);
            }
        });
    }
}

export default ApiServer;