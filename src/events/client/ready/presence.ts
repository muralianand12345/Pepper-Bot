import discord from "discord.js";
import { BotEvent, BotPresence } from "../../../types";

/**
 * Maps activity type strings to Discord.js ActivityType enum
 */
const ACTIVITY_TYPE_MAP: Record<string, discord.ActivityType> = {
    PLAYING: discord.ActivityType.Playing,
    WATCHING: discord.ActivityType.Watching,
    LISTENING: discord.ActivityType.Listening,
    STREAMING: discord.ActivityType.Streaming,
    COMPETING: discord.ActivityType.Competing,
};

/**
 * Replaces placeholder tokens in activity name with actual values
 * @param name - Activity name with potential placeholders
 * @param client - Discord client instance
 * @returns Processed activity name with replaced placeholders
 */
const processActivityName = (name: string, client: discord.Client): string => {
    const replacements = {
        "<clientname>": client.user?.username,
        "<usersize>": client.guilds.cache
            .reduce((acc, guild) => acc + guild.memberCount, 0)
            .toString(),
        "<playersize>": client.manager.players.size.toString(),
        "<guildsize>": client.guilds.cache.size.toString(),
        "<channelsize>": client.channels.cache.size.toString(),
        "<prefix>": (client as any).config.bot.prefix,
    };

    return Object.entries(replacements).reduce(
        (acc, [token, value]) =>
            acc.replace(new RegExp(token, "g"), value ?? ""),
        name
    );
};

/**
 * Creates a list of bot presence activities with processed placeholders
 * @param client - Discord client instance
 * @param activities - Raw activity configurations
 * @returns Processed activity list
 */
const createActivityList = (
    client: discord.Client,
    activities: BotPresence[]
): BotPresence[] =>
    activities.map((activity) => ({
        name: processActivityName(activity.name, client),
        type: ACTIVITY_TYPE_MAP[activity.type] || discord.ActivityType.Playing,
    }));

const event: BotEvent = {
    name: discord.Events.ClientReady,
    execute: async (client: discord.Client): Promise<void> => {
        if (!(client as any).config.bot.presence.enabled) return;

        const activityList = createActivityList(
            client,
            (client as any).config.bot.presence.activity
        );

        let currentIndex = 0;
        setInterval(() => {
            if (currentIndex >= activityList.length) currentIndex = 0;
            client.user?.setActivity(activityList[currentIndex]);
            currentIndex++;
        }, (client as any).config.bot.presence.interval);

        client.user?.setStatus(
            (client as any).config.bot.presence.status.toLowerCase()
        );
    },
};

export default event;
