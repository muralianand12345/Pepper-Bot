const fs = require('fs');
const path = require('path');
require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials
} = require('discord.js');
const Discord = require('discord.js');
const chokidar = require('chokidar');
const { Manager } = require("./module/magmastream"); //Custom with few additions (Looking for the magmastream to add themselves)
const logger = require('./module/logger.js');
const cmdLogger = require('./module/commandlog.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ],
    shards: 'auto',
    fetchAllMembers: true
});

client.setMaxListeners(20);

client.logger = logger;
client.cmdLogger = cmdLogger;

//Config File | No restart needed for config changes
const configPath = path.join(__dirname, 'config/config.json');
let config;

try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
    client.logger.error('Error reading initial configuration file:', error);
    process.exit(1);
}

client.config = config;

//Lavalink

const nodes = client.config.music.lavalink.nodes;
client.manager = new Manager({
    nodes: nodes,
    defaultSearchPlatform: client.config.music.lavalink.defaultsearch,
    send: (id, payload) => {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
    }
});
client.on("raw", (d) => client.manager.updateVoiceState(d));

const watcher = chokidar.watch(configPath);
watcher.on('change', (changedPath) => {
    if (changedPath === configPath) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            client.config = config;
        } catch (error) {
            client.logger.error('Error reloading configuration file:');
            client.logger.error(error);
        }
    }
});

const Token = process.env.TOKEN;
client.discord = Discord;

//handler Read
const handlersPath = path.join(__dirname, 'handlers');
fs.readdirSync(handlersPath).filter((file) => file.endsWith(".js")).forEach((file) => {
    const handler = require(path.join(handlersPath, file));
    client.on(handler.name, (...args) => handler.execute(...args, client));
});

//events Read
const eventsPath = path.join(__dirname, 'events');
fs.readdirSync(eventsPath).forEach((mainDir) => {
    const mainDirPath = path.join(eventsPath, mainDir);
    const stat = fs.statSync(mainDirPath);
    if (stat.isDirectory()) {
        const subFolders = fs.readdirSync(mainDirPath);
        subFolders.forEach((subDir) => {
            const subDirPath = path.join(mainDirPath, subDir);
            const subStat = fs.statSync(subDirPath);
            if (subStat.isDirectory()) {
                const subFiles = fs.readdirSync(subDirPath);
                subFiles.forEach((file) => {
                    if (file.endsWith(".js")) {
                        const filePath = path.join(subDirPath, file);
                        const event = require(filePath);
                        client.on(event.name, (...args) => event.execute(...args, client));
                    }
                });
            }
        });
    }
});

client.login(Token).catch(err => {
    client.logger.error(`[TOKEN-CRASH] Unable to connect to the BOT's Token`.red);
    client.logger.error(err);
    return process.exit();
});

module.exports = client;

process.on('SIGINT', async () => {
    client.logger.warn(`${client.user.username} is shutting down...\n-------------------------------------`);
    process.exit();
});

//Error Handling
process.on('unhandledRejection', async (err, promise) => {
    client.logger.error(err);
});
process.on('uncaughtException', async (err, origin) => {
    client.logger.error(err);
});
client.on('invalidated', () => {
    client.logger.warn(`invalidated`);
});
client.on('invalidRequestWarning', (invalidRequestWarningData) => {
    client.logger.warn(`invalidRequestWarning: ${invalidRequestWarningData}`);
});