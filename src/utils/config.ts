import path from "path";
import { z } from "zod";
import { config } from "dotenv";

/**
 * Schema for validating environment variables
 * Defines the required structure and types for the bot's configuration
 */
const EnvSchema = z.object({
    TOKEN: z.string(),
    MONGO_URI: z.string(),
    DEBUG_MODE: z.union([z.boolean(), z.string()]).transform((val) => {
        if (typeof val === "string") {
            return val.toLowerCase() === "true";
        }
        return val;
    }),
    LASTFM_API_KEY: z.string(),
    SPOTIFY_CLIENT_ID: z.string(),
    SPOTIFY_CLIENT_SECRET: z.string(),
    FEEDBACK_WEBHOOK: z.string(),
});

/**
 * Manages application configuration using environment variables
 * Implements the Singleton pattern to ensure only one configuration instance exists
 * @class ConfigManager
 */
export class ConfigManager {
    private static instance: ConfigManager;
    private config: z.infer<typeof EnvSchema>;

    /**
     * Private constructor to prevent direct instantiation
     * Loads and validates environment variables from the appropriate .env file
     * @private
     * @throws {Error} If environment variables cannot be loaded or validated
     */
    private constructor() {
        const environment = process.env.NODE_ENV || "prod";
        const envPath = path.resolve(process.cwd(), `.env.${environment}`);

        let result;

        // Load environment variables
        if (require("fs").existsSync(envPath)) {
            result = config({ path: envPath });
        } else {
            result = config();
        }

        if (result.error) {
            throw new Error(
                `Failed to load environment variables: ${result.error.message}`
            );
        }

        // Validate environment variables
        try {
            this.config = EnvSchema.parse({
                TOKEN: process.env.TOKEN,
                MONGO_URI: process.env.MONGO_URI,
                DEBUG_MODE: process.env.DEBUG_MODE || false,
                LASTFM_API_KEY: process.env.LASTFM_API_KEY,
                SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
                SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
                FEEDBACK_WEBHOOK: process.env.FEEDBACK_WEBHOOK,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                const missingVars = error.issues.map((issue) =>
                    issue.path.join(".")
                );
                throw new Error(
                    `Missing required environment variables: ${missingVars.join(
                        ", "
                    )}`
                );
            }
            throw error;
        }
    }

    /**
     * Gets the singleton instance of ConfigManager
     * Creates a new instance if one doesn't exist
     * @static
     * @returns {ConfigManager} The singleton ConfigManager instance
     */
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * Retrieves the complete configuration object
     * @returns {z.infer<typeof EnvSchema>} The complete configuration object
     */
    public getConfig(): z.infer<typeof EnvSchema> {
        return this.config;
    }

    /**
     * Gets the Discord bot token
     * @returns {string} The Discord bot token from environment variables
     */
    public getToken(): string {
        return this.config.TOKEN;
    }

    /**
     * Gets the MongoDB connection URI
     * @returns {string} The MongoDB connection URI from environment variables
     */
    public getMongoUri(): string {
        return this.config.MONGO_URI;
    }

    /**
     * Gets the debug mode status
     * @returns {boolean} The current debug mode status
     */
    public isDebugMode(): boolean {
        return this.config.DEBUG_MODE;
    }

    /**
     * Gets the Last.fm API key
     * @returns {string} The Last.fm API key from environment variables
     */
    public getLastFmApiKey(): string {
        return this.config.LASTFM_API_KEY;
    }

    /**
     * Gets the Spotify client ID
     * @returns {string} The Spotify client ID from environment variables
     */
    public getSpotifyClientId(): string {
        return this.config.SPOTIFY_CLIENT_ID;
    }

    /**
     * Gets the Spotify client secret
     * @returns {string} The Spotify client secret from environment variables
     */
    public getSpotifyClientSecret(): string {
        return this.config.SPOTIFY_CLIENT_SECRET;
    }

    /**
     * Gets the feedback webhook URL
     * @returns {string} The feedback webhook URL from environment variables
     */
    public getFeedbackWebhook(): string {
        return this.config.FEEDBACK_WEBHOOK;
    }
}
