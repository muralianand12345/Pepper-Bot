import express from 'express';
import { ILogger } from '../../../../types';

/**
 * Middleware for logging API requests
 */
class LoggerMiddleware {
    private readonly logger: ILogger;

    /**
     * Create a new logger middleware
     * @param logger - Logger instance
     */
    constructor(logger: ILogger) {
        this.logger = logger;
    }

    /**
     * Middleware function to log requests
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    public logRequest = (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ): void => {
        const start = Date.now();
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const hasApiKey = req.headers['x-api-key'] ? 'Yes' : 'No';

        this.logger.debug(`[API] ${req.method} ${req.originalUrl} - IP: ${ip} - API Key: ${hasApiKey}`);

        // Add response logging
        const originalSend = res.send;
        res.send = function (body) {
            return originalSend.call(this, body);
        };

        next();
    };
}

export default LoggerMiddleware;