import { Events, ActivityType } from 'discord.js';

import { BotEvent, Activity } from '../../../types';

const event: BotEvent = {
    name: Events.ClientReady,
    execute: async (client) => {

        if (!client.config.bot.presence.enabled) return;

        const activityList: Activity[] = [];
        const activities: Activity[] = client.config.bot.presence.activity;

        activities.forEach((activity, index) => {

            let activityType: ActivityType = <ActivityType>activity.type;

            switch (activityType) {
                case ActivityType.Playing:
                case ActivityType.Watching:
                case ActivityType.Listening:
                case ActivityType.Streaming:
                case ActivityType.Competing:
                    break;
                default:
                    activityType = ActivityType.Playing;
                    break;
            }

            var activityName = activity.name
                .replace(/<clientname>/g, client.user.username)
                .replace(/<usersize>/g, client.guilds.cache.reduce((a: number, b: { memberCount: number; }) => a + b.memberCount, 0).toString())
                .replace(/<guildsize>/g, client.guilds.cache.size.toString())
                .replace(/<channelsize>/g, client.channels.cache.size.toString())
                .replace(/<prefix>/g, client.config.bot.prefix);

            activityList.push({
                name: activityName,
                type: activity.type
            });
        });

        let i = 0;
        setInterval(() => {
            if (i >= activityList.length) i = 0;
            client.user.setActivity({ name: activityList[i].name, type: activityList[i].type });
            i++;
        }, client.config.bot.presence.interval);
    }
}

export default event;