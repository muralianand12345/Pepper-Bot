const {
    Events,
    ActivityType
} = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    async execute(client) {

        if (!client.config.bot.presence.enabled) return;

        var activityList = [];

        const activities = client.config.bot.presence.activity;
        activities.forEach((activity, index) => {
            switch (activity.type) {
                case 'Playing':
                    activity.type = ActivityType.Playing;
                    break;
                case 'Watching':
                    activity.type = ActivityType.Watching;
                    break;
                case 'Listening':
                    activity.type = ActivityType.Listening;
                    break;
                case 'Streaming':
                    activity.type = ActivityType.Streaming;
                    break;
                case 'Competing':
                    activity.type = ActivityType.Competing;
                    break;
                default:
                    activity.type = ActivityType.Playing;
                    break;
            }

            var activityName = activity.name
                .replace(/<clientname>/g, client.user.username)
                .replace(/<usersize>/g, client.users.cache.size)
                .replace(/<guildsize>/g, client.guilds.cache.size);

            activityList.push({
                name: activityName,
                type: activity.type
            });
        });

        let i = 0;
        setInterval(() => {
            if (i >= activityList.length) i = 0;
            let botStatus = client.config.bot.presence.status;
            client.user.setPresence({ activities: [activityList[i]], status: botStatus });
            i++;
        }, client.config.bot.presence.interval);
    }
}