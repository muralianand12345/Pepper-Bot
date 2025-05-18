import express from 'express';
import { AuthConfig } from '../../../../types';

/**
 * Middleware for authenticating API requests using API key
 */
class AuthMiddleware {
    private readonly config: AuthConfig;

    /**
     * Create a new auth middleware
     * @param config - Authentication configuration
     */
    constructor(config: AuthConfig) {
        this.config = config;
    }

    /**
     * Middleware function to authenticate requests
     * @param req - Express request
     * @param res - Express response
     * @param next - Express next function
     */
    public authenticate = (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ): void => {
        if (!this.config.enabled) {
            next();
            return;
        }

        if (!this.config.apiKey || this.config.apiKey.trim() === '') {
            console.warn('[AUTH] Auth is enabled but no API key is configured');
            res.status(500).json({
                status: 'error',
                message: 'Authentication is misconfigured on the server'
            });
            return;
        }

        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey) {
            res.status(401).json({
                status: 'error',
                message: 'Unauthorized - Missing API key'
            });
            return;
        }

        if (apiKey !== this.config.apiKey) {
            res.status(401).json({
                status: 'error',
                message: 'Unauthorized - Invalid API key'
            });
            return;
        }
        
        next();
    };
}

export default AuthMiddleware;