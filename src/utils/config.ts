import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import yaml from 'yaml';
import { config } from 'dotenv';
import discord from 'discord.js';
import magmastream from 'magmastream';

const EnvSchema = z.object({
	TOKEN: z.string(),
	MONGO_URI: z.string(),
	DEBUG_MODE: z.union([z.boolean(), z.string()]).transform((val) => {
		if (typeof val === 'string') return val.toLowerCase() === 'true';
		return val;
	}),
	API_PORT: z.union([z.number(), z.string()]).optional().transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val)),
	LASTFM_API_KEY: z.string(),
	SPOTIFY_CLIENT_ID: z.string(),
	SPOTIFY_CLIENT_SECRET: z.string(),
	SPOTIFY_REDIRECT_URI: z.string(),
	FEEDBACK_WEBHOOK: z.string(),
	LIVE_SONGS_WEBHOOK: z.string(),
	OPENAI_API_KEY: z.string(),
	OPENAI_BASE_URL: z.string(),
	REDIS_HOST: z.string().optional(),
	REDIS_PORT: z.string().optional(),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_PREFIX: z.string().optional(),
});

/**
 * Manages application configuration using environment variables
 * Implements the Singleton pattern to ensure only one configuration instance exists
 * @class ConfigManager
 */
export class ConfigManager {
	private static instance: ConfigManager;
	private config: z.infer<typeof EnvSchema>;

	private constructor() {
		const result = config({ quiet: true });

		if (result.error) throw new Error(`Failed to load environment variables: ${result.error.message}`);

		try {
			this.config = EnvSchema.parse({
				TOKEN: process.env.TOKEN,
				MONGO_URI: process.env.MONGO_URI,
				DEBUG_MODE: process.env.DEBUG_MODE || false,
				API_PORT: process.env.API_PORT,
				LASTFM_API_KEY: process.env.LASTFM_API_KEY,
				SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
				SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
				SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
				FEEDBACK_WEBHOOK: process.env.FEEDBACK_WEBHOOK,
				LIVE_SONGS_WEBHOOK: process.env.LIVE_SONGS_WEBHOOK,
				OPENAI_API_KEY: process.env.OPENAI_API_KEY,
				OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
				REDIS_HOST: process.env.REDIS_HOST,
				REDIS_PORT: process.env.REDIS_PORT,
				REDIS_PASSWORD: process.env.REDIS_PASSWORD,
				REDIS_PREFIX: process.env.REDIS_PREFIX,
			});
		} catch (error) {
			if (error instanceof z.ZodError) {
				const missingVars = error.issues.map((issue) => issue.path.join('.'));
				throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
			}
			throw error;
		}
	}

	public static getInstance = (): ConfigManager => {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	};

	public getConfig = (): z.infer<typeof EnvSchema> => {
		return this.config;
	};

	public getToken = (): string => {
		return this.config.TOKEN;
	};

	public getMongoUri = (): string => {
		return this.config.MONGO_URI;
	};

	public isDebugMode = (): boolean => {
		return this.config.DEBUG_MODE;
	};

	public getApiPort = (): number | undefined => {
		return this.config.API_PORT;
	};

	public getLastFmApiKey = (): string => {
		return this.config.LASTFM_API_KEY;
	};

	public getSpotifyClientId = (): string => {
		return this.config.SPOTIFY_CLIENT_ID;
	};

	public getSpotifyClientSecret = (): string => {
		return this.config.SPOTIFY_CLIENT_SECRET;
	};

	public getSpotifyRedirectUri = (): string => {
		return this.config.SPOTIFY_REDIRECT_URI;
	};

	public getFeedbackWebhook = (): string => {
		return this.config.FEEDBACK_WEBHOOK;
	};

	public getLiveSongsWebhook = (): string => {
		return this.config.LIVE_SONGS_WEBHOOK;
	};

	public getOpenAiApiKey = (): string => {
		return this.config.OPENAI_API_KEY;
	};

	public getOpenAiBaseUrl = (): string => {
		return this.config.OPENAI_BASE_URL;
	};

	public getRedisConfig = (): magmastream.StateStorageOptions['redisConfig'] | undefined => {
		if (this.config.REDIS_HOST && this.config.REDIS_PORT) {
			return {
				host: this.config.REDIS_HOST,
				port: this.config.REDIS_PORT,
				password: this.config.REDIS_PASSWORD,
				db: 0,
				prefix: this.config.REDIS_PREFIX || 'pepper:',
			};
		}
		return undefined;
	};
}

export const loadConfig = (client: discord.Client) => {
	try {
		const configPath = path.join(__dirname, '../../config/config.yml');
		const file = fs.readFileSync(configPath, 'utf8');
		return yaml.parse(file);
	} catch (error) {
		client.logger.error(`[PEPPER] Failed to load configuration: ${error}`);
		process.exit(1);
	}
};
