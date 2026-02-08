import discord from 'discord.js';

export type BroadcastResult = { found: true; messageId: string; channelId: string; guildId: string | null } | { found: false };

export const send = async (client: discord.Client, channelId: string, message: string | discord.MessageCreateOptions): Promise<discord.Message | null> => {
	if (client.shard) {
		const results = await client.shard
			.broadcastEval(
				async (c, context): Promise<BroadcastResult> => {
					const channel = c.channels.cache.get(context.channelId);
					if (channel?.isSendable()) {
						const msg = await channel.send(context.message as string | discord.MessageCreateOptions);
						return { found: true, messageId: msg.id, channelId: msg.channelId, guildId: msg.guildId };
					}
					return { found: false };
				},
				{ context: { channelId, message } },
			)
			.catch((): BroadcastResult[] => [{ found: false }]);

		const successResult = results.find((r): r is Extract<BroadcastResult, { found: true }> => r.found);
		if (successResult) {
			const channel = client.channels.cache.get(successResult.channelId) as discord.TextChannel;
			if (channel) return channel.messages.fetch(successResult.messageId).catch(() => null);
		}
		return null;
	}

	const channel = client.channels.cache.get(channelId);
	if (channel?.isSendable()) return channel.send(message);
	return null;
};
