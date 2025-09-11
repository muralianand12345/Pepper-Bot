import discord from 'discord.js';
import { Manager, UseNodeOptions, StateStorageType, AutoPlayPlatform, DiscordPacket } from 'magmastream';

import Logger from './utils/logger';
import { Command, IConfig } from './types';
import CommandLogger from './utils/command_logger';
import { LocalizationManager } from './core/locales';
import { ConfigManager, loadConfig } from './utils/config';

const configManager = ConfigManager.getInstance();

const initializeManager = (config: IConfig, client: discord.Client) => {
	return new Manager({
		stateStorage: {
			type: StateStorageType.Redis,
			redisConfig: configManager.getRedisConfig(),
			deleteInactivePlayers: true
		},
		enablePriorityMode: true,
		playNextOnEnd: true,
		autoPlaySearchPlatforms: [AutoPlayPlatform.Spotify, AutoPlayPlatform.SoundCloud],
		clientName: 'Pepper',
		defaultSearchPlatform: config.music.lavalink.default_search,
		lastFmApiKey: configManager.getLastFmApiKey(),
		nodes: config.music.lavalink.nodes,
		useNode: UseNodeOptions.LeastLoad, // UseNodeOptions.LeastLoad | UseNodeOptions.LeastPlayers
		send: (packet: DiscordPacket): void => {
			const guild = client.guilds.cache.get(packet.d?.guild_id);
			if (guild) guild.shard.send(packet);
		},
	});
};

const createClient = (): discord.Client => {
	const client = new discord.Client({ intents: [discord.GatewayIntentBits.Guilds, discord.GatewayIntentBits.GuildWebhooks, discord.GatewayIntentBits.GuildMessages, discord.GatewayIntentBits.GuildVoiceStates] });

	client.logger = new Logger();
	client.cmdLogger = new CommandLogger();
	client.commands = new discord.Collection<string, Command>();
	client.cooldowns = new discord.Collection<string, number>();
	client.config = loadConfig(client);
	client.manager = initializeManager(client.config, client);
	client.localizationManager = LocalizationManager.getInstance();
	client.on(discord.Events.Raw, (d) => client.manager.updateVoiceState(d));

	return client;
};

const client = createClient();

export default client;
