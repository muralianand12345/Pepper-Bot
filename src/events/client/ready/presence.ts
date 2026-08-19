import discord from 'discord.js';

import { version } from '../../../../package.json';
import { BotEvent, BotPresence } from '../../../types';
import { getGlobalStats, GlobalStats } from '../../../utils/shard';

const ACTIVITY_TYPE_MAP: Record<string, discord.ActivityType> = {
	PLAYING: discord.ActivityType.Playing,
	WATCHING: discord.ActivityType.Watching,
	LISTENING: discord.ActivityType.Listening,
	STREAMING: discord.ActivityType.Streaming,
	COMPETING: discord.ActivityType.Competing,
};

const processActivityName = (name: string, client: discord.Client, stats: GlobalStats): string => {
	const replacements = {
		'<version>': version,
		'<clientname>': client.user?.username,
		'<usersize>': stats.members.toLocaleString(),
		'<playersize>': stats.players.toLocaleString(),
		'<guildsize>': stats.guilds.toLocaleString(),
		'<channelsize>': stats.channels.toLocaleString(),
		'<shardsize>': stats.shards.toLocaleString(),
		'<shardid>': (client.shard?.ids[0] ?? 0).toString(),
	};

	return Object.entries(replacements).reduce((acc, [token, value]) => acc.replace(new RegExp(token, 'g'), value ?? ''), name);
};

const createActivityList = (client: discord.Client, activities: BotPresence[], stats: GlobalStats): BotPresence[] => activities.map((activity) => ({ name: processActivityName(activity.name, client, stats), type: ACTIVITY_TYPE_MAP[activity.type] || discord.ActivityType.Playing }));

const event: BotEvent = {
	name: discord.Events.ClientReady,
	execute: async (client: discord.Client): Promise<void> => {
		if (!client.config.bot.presence.enabled) return;

		let currentIndex = 0;
		setInterval(async () => {
			try {
				const stats = await getGlobalStats(client);
				const activityList = createActivityList(client, client.config.bot.presence.activity, stats);
				if (!activityList.length) return;
				if (currentIndex >= activityList.length) currentIndex = 0;
				client.user?.setActivity(activityList[currentIndex]);
				currentIndex++;
			} catch (error) {
				client.logger.warn(`[PRESENCE] Failed to update activity: ${error}`);
			}
		}, client.config.bot.presence.interval);

		client.user?.setStatus(client.config.bot.presence.status);
	},
};

export default event;
