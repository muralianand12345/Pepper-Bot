import fs from "fs";
import path from "path";
import yaml from "yaml";
import discord from "discord.js";
import { Manager, UseNodeOptions } from "magmastream";

import { Command } from "./types";
import Logger from "./utils/logger";
import { ConfigManager } from "./utils/config";
import CommandLogger from "./utils/command_logger";


const configManager = ConfigManager.getInstance();

const loadConfig = (client: discord.Client) => {
    try {
        const configPath = path.join(__dirname, "../config/config.yml");
        const file = fs.readFileSync(configPath, "utf8");
        return yaml.parse(file);
    } catch (error) {
        client.logger.error(`[PEPPER] Failed to load configuration: ${error}`);
        process.exit(1);
    }
};

const initializeManager = (config: any, client: discord.Client) => {
    return new Manager({
        usePriority: true,
        useNode: UseNodeOptions.LeastLoad, // UseNodeOptions.LeastLoad | UseNodeOptions.LeastPlayers
        nodes: config.music.lavalink.nodes,
        autoPlay: true,
        defaultSearchPlatform: config.music.lavalink.default_search,
        lastFmApiKey: configManager.getLastFmApiKey(),
        send: (id: string, payload: any) => {
            const guild = client.guilds.cache.get(id);
            if (guild) guild.shard.send(payload);
        },
    });
};

const createClient = (): discord.Client => {
    const client = new discord.Client({
        intents: [
            discord.GatewayIntentBits.Guilds,
            discord.GatewayIntentBits.GuildWebhooks,
            discord.GatewayIntentBits.GuildMessages,
            discord.GatewayIntentBits.GuildVoiceStates,
        ]
    });

    client.logger = new Logger();
    client.cmdLogger = new CommandLogger();
    client.commands = new discord.Collection<string, Command>();
    client.cooldowns = new discord.Collection<string, number>();
    client.config = loadConfig(client);
    client.manager = initializeManager(client.config, client);
    client.on(discord.Events.Raw, (d) => client.manager.updateVoiceState(d));

    return client;
};

const client = createClient();

export default client;