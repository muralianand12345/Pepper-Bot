import discord from 'discord.js';

export const send = async (client: discord.Client, channelId: string, message: string | discord.MessageCreateOptions) => {
	return client.shard
		?.broadcastEval(
			async (c, context) => {
				const channel = c.channels.cache.get(context.channelId);
				if (channel?.isSendable()) {
					await channel.send(context.message as string | discord.MessageCreateOptions);
					return true;
				}
				return false;
			},
			{ context: { channelId, message } }
		)
		.then((results) => results.some((result) => result === true))
		.catch(() => false);
};
