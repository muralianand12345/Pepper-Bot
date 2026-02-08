import discord from 'discord.js';

export const checkUserPremium = async (client: discord.Client, userId: string): Promise<{ isPremium: boolean; tier: number }> => {
	const guild = client.guilds.cache.get(client.config.bot.support_server.id);
	if (!guild) return { isPremium: false, tier: 0 };
	const member = await guild.members.fetch(userId).catch(() => null);
	if (!member) return { isPremium: false, tier: 0 };
	return { isPremium: true, tier: 1 };
};
