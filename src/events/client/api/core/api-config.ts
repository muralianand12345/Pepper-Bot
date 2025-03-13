import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { IConfig } from '../../../../types';

/**
 * Configuration for the API server
 */
class ApiConfig {
    private static instance: ApiConfig;
    private readonly port: number;
    private readonly rateLimitWindow: number;
    private readonly rateLimitMax: number;

    /**
     * Initialize API configuration
     * @param config - Bot configuration object
     */
    private constructor(config: IConfig) {
        // Default to port 3000 if not specified in config
        this.port = config.api?.port || 3000;

        // Rate limiting config (15 minutes window, 100 requests max by default)
        this.rateLimitWindow = config.api?.rateLimit?.windowMs || 15 * 60 * 1000;
        this.rateLimitMax = config.api?.rateLimit?.max || 100;
    }

    /**
     * Get singleton instance of ApiConfig
     * @param config - Bot configuration object
     * @returns ApiConfig instance
     */
    public static getInstance(config: IConfig): ApiConfig {
        if (!ApiConfig.instance) {
            ApiConfig.instance = new ApiConfig(config);
        }
        return ApiConfig.instance;
    }

    /**
     * Configure Express application with middleware
     * @param app - Express application
     * @returns Configured Express application
     */
    public configureApp(app: express.Application): express.Application {
        // Security middleware
        app.use(helmet());
        app.use(cors());

        // JSON body parser with increased limit for larger payloads
        app.use(express.json({ limit: '2mb' }));
        app.use(express.urlencoded({ extended: true, limit: '2mb' }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: this.rateLimitWindow,
            max: this.rateLimitMax,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                status: 429,
                message: 'Too many requests, please try again later.'
            }
        });

        // Apply rate limiting to all routes
        app.use(limiter);

        return app;
    }

    /**
     * Get configured port
     * @returns Port number
     */
    public getPort(): number {
        return this.port;
    }
}

export default ApiConfig;