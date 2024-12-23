import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { config } from 'dotenv';
import discord from 'discord.js';
import { Manager } from 'magmastream';
import Logger from './utils/logger';
import CommandLogger from './utils/command_logger';
import { Command, SlashCommand } from './types';

config();

/**
 * Loads configuration from YAML file
 * @returns Configuration object
 */
const loadConfig = () => {
    try {
        const configPath = path.join(__dirname, '../config/config.yml');
        const file = fs.readFileSync(configPath, 'utf8');
        return yaml.parse(file);
    } catch (error) {
        console.error('Failed to load configuration:', error);
        process.exit(1);
    }
};

/**
 * Initializes the Lavalink manager configuration
 * @param config The application configuration
 * @param client The Discord client instance
 * @returns Manager instance
 */
const initializeManager = (config: any, client: discord.Client) => {
    return new Manager({
        nodes: config.music.lavalink.nodes,
        defaultSearchPlatform: config.music.lavalink.default_search,
        send: (id: string, payload: any) => {
            const guild = client.guilds.cache.get(id);
            if (guild) guild.shard.send(payload);
        },
    });
};

/**
 * Creates and configures the Discord client with all necessary properties
 * @returns Configured Discord client
 */
const createClient = (): discord.Client => {

    const client = new discord.Client({
        intents: [
            discord.GatewayIntentBits.Guilds,
            discord.GatewayIntentBits.GuildWebhooks,
            discord.GatewayIntentBits.GuildMessages,
            discord.GatewayIntentBits.GuildVoiceStates,
        ],
        shards: 'auto'
    });

    // Initialize client properties
    client.logger = new Logger();
    client.cmdLogger = new CommandLogger();

    // Initialize collections
    client.slashCommands = new discord.Collection<string, SlashCommand>();
    client.commands = new discord.Collection<string, Command>();
    client.cooldowns = new discord.Collection<string, number>();

    // Load configuration
    client.config = loadConfig();

    // Initialize manager with config
    client.manager = initializeManager(client.config, client);

    return client;
};

// Create the client instance
const client = createClient();

export default client;