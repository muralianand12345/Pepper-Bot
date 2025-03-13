import discord from 'discord.js';
import { ILogger } from '../../../../types';

/**
 * Utility class for diagnosing API configuration issues
 */
class ApiDiagnostic {
    private readonly client: discord.Client;
    private readonly logger: ILogger;

    /**
     * Create a new API diagnostic utility
     * @param client - Discord client
     * @param logger - Logger instance
     */
    constructor(client: discord.Client, logger: ILogger) {
        this.client = client;
        this.logger = logger;
    }

    /**
     * Run diagnostic checks on the API configuration
     * Logs warnings for common issues
     */
    public runDiagnostics(): void {
        this.logger.info('[API] Running API configuration diagnostics...');

        // Check if API is enabled
        if (!this.client.config.api?.enabled) {
            this.logger.warn('[API] API is disabled in configuration');
            return;
        }

        // Check port configuration
        const port = this.client.config.api?.port;
        if (!port) {
            this.logger.warn('[API] No port specified in configuration, defaulting to 3000');
        } else if (port < 1024 && process.platform !== 'win32') {
            this.logger.warn(`[API] Port ${port} requires elevated privileges on this platform`);
        } else if (port < 0 || port > 65535) {
            this.logger.error(`[API] Invalid port number: ${port}`);
        }

        // Check authentication configuration
        const authEnabled = this.client.config.api?.auth?.enabled;
        const apiKey = this.client.config.api?.auth?.apiKey;

        if (authEnabled) {
            if (!apiKey) {
                this.logger.error('[API] Authentication is enabled but no API key is configured');
            } else if (apiKey.length < 16) {
                this.logger.warn('[API] API key is shorter than recommended (16+ characters)');
            }

            if (apiKey === 'your-secure-api-key-here') {
                this.logger.error('[API] Default API key detected - please change this!');
            }
        } else {
            this.logger.warn('[API] Authentication is disabled - API endpoints are publicly accessible');
        }

        // Check rate limiting configuration
        const rateLimitWindow = this.client.config.api?.rateLimit?.windowMs;
        const rateLimitMax = this.client.config.api?.rateLimit?.max;

        if (!rateLimitWindow || !rateLimitMax) {
            this.logger.warn('[API] Rate limiting is not properly configured');
        } else if (rateLimitMax > 1000) {
            this.logger.warn(`[API] Rate limit max requests (${rateLimitMax}) is unusually high`);
        }

        this.logger.info('[API] Diagnostics completed');
    }
}

export default ApiDiagnostic;