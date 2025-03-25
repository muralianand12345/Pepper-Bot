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
        // Default to port 3000 if not specified in config
        this.port = config.api?.port || 3000;

        //origin is the URL of the website that is allowed to access the API
        this.origin = config.api?.origin || '*';

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

        // Apply CORS middleware FIRST, before any routes
        app.use(cors({
            origin: this.origin,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
        }));

        // Set trust proxy to be specific to Cloudflare
        app.set('trust proxy', [
            // Cloudflare IPv4 ranges
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
            },
            // Use a custom key generator that includes proxied IP
            keyGenerator: (req) => {
                // Get the IP from X-Forwarded-For when behind Cloudflare
                const ip = req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
                return `${ip}:${req.path}`;
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