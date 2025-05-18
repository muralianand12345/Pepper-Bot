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
import { version } from '../../../../../package.json';

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
        this.authMiddleware = new AuthMiddleware({
            enabled: client.config.api?.auth?.enabled || false,
            apiKey: client.config.api?.auth?.apiKey || ''
        });
        this.loggerMiddleware = new LoggerMiddleware(this.logger);

        this.apiConfig.configureApp(this.app);
        this.app.use(this.loggerMiddleware.logRequest);
        this.app.use('/swagger-assets', express.static(path.join(__dirname, '../../../../../static/')));

        this.registerRoutes();
    }

    /**
     * Register API routes
     */
    private registerRoutes(): void {
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

        this.app.get('/docs.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });

        this.app.get('/music/docs', (req, res) => {
            try {
                res.sendFile(path.join(__dirname, '../../../../../static/websocket_ui.html'));
            } catch (error) {
                res.status(500).send('Error loading WebSocket documentation');
            }
        });

        this.app.get('/version', (req, res) => {
            res.json({
                version: version,
                timestamp: new Date().toISOString()
            });
        });

        this.app.use('/static', express.static(path.join(__dirname, '../../../../../static/')));
        this.app.get('/api', (req, res) => {
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

        const apiRouter = express.Router();

        apiRouter.use(this.authMiddleware.authenticate);

        const commandRoutes = require('../routes/commands').default;
        const infoRoutes = require('../routes/info').default;
        const healthRoutes = require('../routes/health').default;
        const musicRoutes = require('../routes/music').default;

        apiRouter.use('/commands', commandRoutes(this.client));
        apiRouter.use('/info', infoRoutes(this.client));
        apiRouter.use('/health', healthRoutes(this.client));
        apiRouter.use('/music', musicRoutes(this.client));
        this.app.use('/api/v1', apiRouter);
        this.app.use('*', (req, res) => {
            res.status(404).json({
                status: 'error',
                message: 'Endpoint not found'
            });
        });

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
        const diagnostic = new ApiDiagnostic(this.client, this.logger);
        diagnostic.runDiagnostics();
        const port = this.apiConfig.getPort();

        this.httpServer = http.createServer(this.app);
        (this.client as any).httpServer = this.httpServer;

        WebSocketManager.getInstance(this.client, this.httpServer, this.logger);

        this.httpServer.listen(port, () => {
            this.logger.info(`[API] Server started on port ${port}`);
            this.logger.info(`[API] Swagger documentation available at http://localhost:${port}/docs`);
            this.logger.info(`[API] WebSocket endpoint available at ws://localhost:${port}/api/v1/music/ws`);

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