import discord from 'discord.js';
import magmastream from 'magmastream';

import { IConfig } from './config';
import { ILogger } from './logger';
import { Command } from './events';
import CommandLogger from '../utils/command_logger';
import { LocalizationManager } from '../core/locales';

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DEBUG_MODE: boolean | string;
			TOKEN: string;
			MONGO_URI: string;
			LASTFM_API_KEY: string;
			SPOTIFY_CLIENT_ID: string;
			SPOTIFY_CLIENT_SECRET: string;
			FEEDBACK_WEBHOOK: string;
		}
	}
}

declare module 'discord.js' {
	export interface Client {
		commands: discord.Collection<string, Command>;
		cooldowns: discord.Collection<string, number>;
		logger: ILogger;
		cmdLogger: CommandLogger;
		config: IConfig;
		manager: magmastream.Manager;
		localizationManager?: LocalizationManager;
	}
}

declare module 'magmastream' {
	interface Player {
		cleanupScheduledAt?: number;
	}
}

export * from './db';
export * from './music';
export * from './logger';
export * from './events';
export * from './config';
export * from './locales';
