import { Events, ActivityType, PresenceUpdateStatus } from 'discord.js';

import { BotEvent, Activity } from '../../../types';

const event: BotEvent = {
    name: Events.ClientReady,
    execute: async (client) => {

        if (!client.config.bot.presence.enabled) return;

        const activityList: Activity[] = [];
        const activities: Activity[] = client.config.bot.presence.activity;

        const activityTypeMap: { [key: string]: ActivityType } = {
            'PLAYING': ActivityType.Playing,
            'WATCHING': ActivityType.Watching,
            'LISTENING': ActivityType.Listening,
            'STREAMING': ActivityType.Streaming,
            'COMPETING': ActivityType.Competing
        };

        activities.forEach((activity) => {
            let activityType = activityTypeMap[activity.type] || ActivityType.Playing;

            const activityName = activity.name
                .replace(/<clientname>/g, client.user!.username)
                .replace(/<usersize>/g, client.guilds.cache.reduce((a: number, b: { memberCount: number }) => a + b.memberCount, 0).toString())
                .replace(/<guildsize>/g, client.guilds.cache.size.toString())
                .replace(/<channelsize>/g, client.channels.cache.size.toString())
                .replace(/<prefix>/g, client.config.bot.prefix);

            activityList.push({
                name: activityName,
                type: activityType
            });
        });

        let i = 0;
        setInterval(() => {
            if (i >= activityList.length) i = 0;
            client.user!.setActivity(activityList[i]);
            i++;
        }, client.config.bot.presence.interval);

        client.user.setStatus(PresenceUpdateStatus.Idle);
    }
}

export default event;