"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = require("magmastream");
const logger_1 = __importDefault(require("./utils/logger"));
const command_logger_1 = __importDefault(require("./utils/command_logger"));
const locales_1 = require("./core/locales");
const config_1 = require("./utils/config");
const configManager = config_1.ConfigManager.getInstance();
const initializeManager = (config, client) => {
    return new magmastream_1.Manager({
        autoPlay: true,
        autoPlaySearchPlatform: magmastream_1.SearchPlatform.Jiosaavn,
        defaultSearchPlatform: config.music.lavalink.default_search,
        lastFmApiKey: configManager.getLastFmApiKey(),
        nodes: config.music.lavalink.nodes,
        useNode: magmastream_1.UseNodeOptions.LeastLoad, // UseNodeOptions.LeastLoad | UseNodeOptions.LeastPlayers
        usePriority: true,
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild)
                guild.shard.send(payload);
        },
    });
};
const createClient = () => {
    const client = new discord_js_1.default.Client({
        intents: [discord_js_1.default.GatewayIntentBits.Guilds, discord_js_1.default.GatewayIntentBits.GuildWebhooks, discord_js_1.default.GatewayIntentBits.GuildMessages, discord_js_1.default.GatewayIntentBits.GuildVoiceStates],
    });
    client.logger = new logger_1.default();
    client.cmdLogger = new command_logger_1.default();
    client.commands = new discord_js_1.default.Collection();
    client.cooldowns = new discord_js_1.default.Collection();
    client.config = (0, config_1.loadConfig)(client);
    client.manager = initializeManager(client.config, client);
    client.localizationManager = locales_1.LocalizationManager.getInstance();
    client.on(discord_js_1.default.Events.Raw, (d) => client.manager.updateVoiceState(d));
    return client;
};
const client = createClient();
exports.default = client;
