import discord from 'discord.js';
import magmastream from 'magmastream';

import { BotPresence } from './events';

export interface IConfig {
	bot: {
		owners: Array<string>;
		presence: {
			enabled: boolean;
			status: discord.PresenceStatusData;
			interval: number;
			activity: Array<BotPresence>;
		};
		command: {
			cooldown_message: string;
		};
		log: {
			command: string;
			server: string;
		};
	};
	survey?: {
		enabled: boolean;
		url: string;
		probability: number;
		cooldown: number;
	};
	music: {
		enabled: boolean;
		cache: {
			enabled: boolean;
			max_size: number;
			default_search_ttl: number;
			defaukt_url_ttl: number;
			cleanup_interval: number;
		};
		lavalink: {
			default_search: magmastream.SearchPlatform;
			nodes: Array<{
				identifier: string;
				host: string;
				port: number;
				password: string;
				secure: boolean;
				retryAmount: number;
				retrydelay: number;
				resumeStatus: boolean;
				resumeTimeout: number;
			}>;
		};
	};
}
