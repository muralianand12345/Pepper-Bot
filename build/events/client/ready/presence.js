"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const package_json_1 = require("../../../../package.json");
const ACTIVITY_TYPE_MAP = {
    PLAYING: discord_js_1.default.ActivityType.Playing,
    WATCHING: discord_js_1.default.ActivityType.Watching,
    LISTENING: discord_js_1.default.ActivityType.Listening,
    STREAMING: discord_js_1.default.ActivityType.Streaming,
    COMPETING: discord_js_1.default.ActivityType.Competing,
};
const processActivityName = (name, client) => {
    const replacements = {
        "<version>": package_json_1.version,
        "<clientname>": client.user?.username,
        "<usersize>": client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0).toString(),
        "<playersize>": client.manager.players.size.toString(),
        "<guildsize>": client.guilds.cache.size.toString(),
        "<channelsize>": client.channels.cache.size.toString(),
    };
    return Object.entries(replacements).reduce((acc, [token, value]) => acc.replace(new RegExp(token, "g"), value ?? ""), name);
};
const createActivityList = (client, activities) => activities.map((activity) => ({ name: processActivityName(activity.name, client), type: ACTIVITY_TYPE_MAP[activity.type] || discord_js_1.default.ActivityType.Playing }));
const event = {
    name: discord_js_1.default.Events.ClientReady,
    execute: async (client) => {
        if (!client.config.bot.presence.enabled)
            return;
        let currentIndex = 0;
        setInterval(() => {
            let activityList = createActivityList(client, client.config.bot.presence.activity);
            if (currentIndex >= activityList.length)
                currentIndex = 0;
            client.user?.setActivity(activityList[currentIndex]);
            currentIndex++;
        }, client.config.bot.presence.interval);
        client.user?.setStatus(client.config.bot.presence.status);
    },
};
exports.default = event;
