import * as fs from 'fs';
import * as path from 'path';
import { Client, GatewayIntentBits, Collection } from "discord.js";
import * as Discord from 'discord.js';
import * as dotenv from 'dotenv';
import * as chokidar from 'chokidar';

import { Manager } from './module/magmastream';
import logger from './module/logger';
import * as cmdLogger from './module/commandLog';
import { Command, SlashCommand } from "./types";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        //GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildMessages,
        //GatewayIntentBits.DirectMessages,
        //GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
    shards: 'auto'
});

client.logger = logger;
client.cmdLogger = cmdLogger;

client.slashCommands = new Collection<string, SlashCommand>()
client.commands = new Collection<string, Command>()
client.cooldowns = new Collection<string, number>()

const configPath = path.join(__dirname, 'config/config.json');
let config: any;

try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err: any) {
    client.logger.error('Error reading initial configuration file');
    process.exit(1);
}

client.config = config;

const nodes = client.config.music.lavalink.nodes;
client.manager = new Manager({
    nodes: nodes,
    defaultSearchPlatform: client.config.music.lavalink.defaultsearch,
    send: (id, payload) => {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
    },
});
client.on('raw', (d) => client.manager.updateVoiceState(d));

const watcher = chokidar.watch(configPath);
watcher.on('change', (changedPath) => {
    if (changedPath === configPath) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            client.config = config;
        } catch (error: any) {
            client.logger.error('Error reloading configuration file:');
            client.logger.error(error);
        }
    }
});

client.discord = Discord;

const handlersPath = path.join(__dirname, 'handlers');
fs.readdirSync(handlersPath)
    .filter((file) => file.endsWith('.js'))
    .forEach((file) => {
        let handler = require(path.join(handlersPath, file)).default
        client.on(handler.name, (...args) => handler.execute(...args, client));
    });

const eventsPath = path.join(__dirname, 'events');
fs.readdirSync(eventsPath).forEach((mainDir) => {
    let mainDirPath = path.join(eventsPath, mainDir);
    let stat = fs.statSync(mainDirPath);
    if (stat.isDirectory()) {
        let subFolders = fs.readdirSync(mainDirPath);
        subFolders.forEach((subDir) => {
            let subDirPath = path.join(mainDirPath, subDir);
            let subStat = fs.statSync(subDirPath);
            if (subStat.isDirectory()) {
                let subFiles = fs.readdirSync(subDirPath);
                subFiles.forEach((file) => {
                    if (file.endsWith('.js')) {
                        let filePath = path.join(subDirPath, file);
                        let event = require(filePath).default
                        event.once ? client.once(event.name, (...args) => event.execute(...args, client)) :
                            client.on(event.name, (...args) => event.execute(...args, client));
                    }
                });
            }
        });
    }
});

client.login(process.env.TOKEN).catch((err: any) => {
    client.logger.error(`[TOKEN-CRASH] Unable to connect to the BOT's Token`);
    client.logger.error(err);
    return process.exit();
});

export = client;

process.on('SIGINT', async () => {
    client.logger.warn(`${client.user?.username} is shutting down...\n-------------------------------------`);
    process.exit();
});

process.on('unhandledRejection', async (err: any, promise) => {
    client.logger.error(err);
});
process.on('uncaughtException', async (err: any, origin) => {
    client.logger.error(err);
});
client.on('invalidated', () => {
    client.logger.warn(`invalidated`);
});
client.on('invalidRequestWarning', (invalidRequestWarningData) => {
    client.logger.warn(`invalidRequestWarning: ${invalidRequestWarningData}`);
});