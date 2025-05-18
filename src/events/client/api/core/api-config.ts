import cors from 'cors';
import express from 'express';
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
    private readonly origin: Array<string> | string;

    /**
     * Initialize API configuration
     * @param config - Bot configuration object
     */
    private constructor(config: IConfig) {
        this.port = config.api?.port || 3000;
        this.origin = config.api?.origin || '*';
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

        app.use(cors({
            origin: this.origin,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
        }));

        app.set('trust proxy', [
            '173.245.48.0/20',
            '103.21.244.0/22',
            '103.22.200.0/22',
            '103.31.4.0/22',
            '141.101.64.0/18',
            '108.162.192.0/18',
            '190.93.240.0/20',
            '188.114.96.0/20',
            '197.234.240.0/22',
            '198.41.128.0/17',
            '162.158.0.0/15',
            '104.16.0.0/13',
            '104.24.0.0/14',
            '172.64.0.0/13',
            '131.0.72.0/22'
        ]);

        app.use(express.json({ limit: '2mb' }));
        app.use(express.urlencoded({ extended: true, limit: '2mb' }));

        const limiter = rateLimit({
            windowMs: this.rateLimitWindow,
            max: this.rateLimitMax,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                status: 429,
                message: 'Too many requests, please try again later.'
            },
            keyGenerator: (req) => {
                const ip = req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
                return `${ip}:${req.path}`;
            }
        });

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