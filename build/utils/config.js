"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = exports.ConfigManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const yaml_1 = __importDefault(require("yaml"));
const dotenv_1 = require("dotenv");
const EnvSchema = zod_1.z.object({
    TOKEN: zod_1.z.string(),
    MONGO_URI: zod_1.z.string(),
    DEBUG_MODE: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string()]).transform((val) => {
        if (typeof val === 'string')
            return val.toLowerCase() === 'true';
        return val;
    }),
    LASTFM_API_KEY: zod_1.z.string(),
    SPOTIFY_CLIENT_ID: zod_1.z.string(),
    SPOTIFY_CLIENT_SECRET: zod_1.z.string(),
    FEEDBACK_WEBHOOK: zod_1.z.string(),
    LIVE_SONGS_WEBHOOK: zod_1.z.string(),
});
/**
 * Manages application configuration using environment variables
 * Implements the Singleton pattern to ensure only one configuration instance exists
 * @class ConfigManager
 */
class ConfigManager {
    constructor() {
        this.getConfig = () => {
            return this.config;
        };
        this.getToken = () => {
            return this.config.TOKEN;
        };
        this.getMongoUri = () => {
            return this.config.MONGO_URI;
        };
        this.isDebugMode = () => {
            return this.config.DEBUG_MODE;
        };
        this.getLastFmApiKey = () => {
            return this.config.LASTFM_API_KEY;
        };
        this.getSpotifyClientId = () => {
            return this.config.SPOTIFY_CLIENT_ID;
        };
        this.getSpotifyClientSecret = () => {
            return this.config.SPOTIFY_CLIENT_SECRET;
        };
        this.getFeedbackWebhook = () => {
            return this.config.FEEDBACK_WEBHOOK;
        };
        this.getLiveSongsWebhook = () => {
            return this.config.LIVE_SONGS_WEBHOOK;
        };
        const result = (0, dotenv_1.config)();
        if (result.error)
            throw new Error(`Failed to load environment variables: ${result.error.message}`);
        try {
            this.config = EnvSchema.parse({
                TOKEN: process.env.TOKEN,
                MONGO_URI: process.env.MONGO_URI,
                DEBUG_MODE: process.env.DEBUG_MODE || false,
                LASTFM_API_KEY: process.env.LASTFM_API_KEY,
                SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
                SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
                FEEDBACK_WEBHOOK: process.env.FEEDBACK_WEBHOOK,
                LIVE_SONGS_WEBHOOK: process.env.LIVE_SONGS_WEBHOOK,
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const missingVars = error.issues.map((issue) => issue.path.join('.'));
                throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
            }
            throw error;
        }
    }
}
exports.ConfigManager = ConfigManager;
ConfigManager.getInstance = () => {
    if (!ConfigManager.instance) {
        ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
};
const loadConfig = (client) => {
    try {
        const configPath = path_1.default.join(__dirname, '../../config/config.yml');
        const file = fs_1.default.readFileSync(configPath, 'utf8');
        return yaml_1.default.parse(file);
    }
    catch (error) {
        client.logger.error(`[PEPPER] Failed to load configuration: ${error}`);
        process.exit(1);
    }
};
exports.loadConfig = loadConfig;
