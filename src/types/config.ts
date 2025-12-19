import discord from 'discord.js';
import magmastream from 'magmastream';

import { BotPresence } from './events';

export interface IConfig {
	bot: {
		owners: Array<string>;
		support_server: {
			id: string;
			invite: string;
		};
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
	premium: {
		tiers: Array<{
			id: number;
			name: string;
			feature: {
				playlist_limit: number | null;
			};
		}>;
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
		feature: {
			voice_status: {
				enabled: boolean;
			};
			progress_bar: {
				enabled: boolean;
			};
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
