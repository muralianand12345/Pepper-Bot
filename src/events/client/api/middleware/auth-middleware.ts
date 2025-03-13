import express from 'express';

/**
 * Configuration for API authentication
 */
interface AuthConfig {
    enabled: boolean;
    apiKey: string;
}

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
        // Skip authentication if disabled
        if (!this.config.enabled) {
            next();
            return;
        }

        // Make sure we have a valid API key configured
        if (!this.config.apiKey || this.config.apiKey.trim() === '') {
            console.warn('[AUTH] Auth is enabled but no API key is configured');
            res.status(500).json({
                status: 'error',
                message: 'Authentication is misconfigured on the server'
            });
            return;
        }

        // Get the API key from request headers
        const apiKey = req.headers['x-api-key'] as string;

        // Check if API key is provided
        if (!apiKey) {
            res.status(401).json({
                status: 'error',
                message: 'Unauthorized - Missing API key'
            });
            return;
        }

        // Check if API key is valid
        if (apiKey !== this.config.apiKey) {
            res.status(401).json({
                status: 'error',
                message: 'Unauthorized - Invalid API key'
            });
            return;
        }

        // Authentication successful
        next();
    };
}

export default AuthMiddleware;