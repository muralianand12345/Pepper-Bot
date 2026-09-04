import discord from 'discord.js';

export type BroadcastResult = { found: true; messageId: string; channelId: string; guildId: string | null } | { found: false };

export type MessageRef = { messageId: string; channelId: string; local: boolean };

const sendLocal = async (client: discord.Client, channelId: string, message: string | discord.MessageCreateOptions): Promise<discord.Message | null> => {
	const channel = client.channels.cache.get(channelId);
	if (!channel?.isSendable()) return null;
	return channel.send(message).catch((error) => {
		client.logger?.warn(`[SEND] Failed to send to channel ${channelId}: ${error}`);
		return null;
	});
};

const sendRemote = async (client: discord.Client, channelId: string, message: string | discord.MessageCreateOptions): Promise<MessageRef | null> => {
	if (!client.shard) return null;

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
		.catch((error): BroadcastResult[] => {
			client.logger?.warn(`[SEND] Broadcast send failed for channel ${channelId}: ${error}`);
			return [{ found: false }];
		});

	const success = results.find((r): r is Extract<BroadcastResult, { found: true }> => r.found);
	if (!success) return null;
	return { messageId: success.messageId, channelId: success.channelId, local: false };
};

export const send = async (client: discord.Client, channelId: string, message: string | discord.MessageCreateOptions): Promise<discord.Message | null> => {
	const local = await sendLocal(client, channelId, message);
	if (local) return local;
	if (!client.shard) return null;
	await sendRemote(client, channelId, message);
	return null;
};

export const sendRef = async (client: discord.Client, channelId: string, message: string | discord.MessageCreateOptions): Promise<MessageRef | null> => {
	const local = await sendLocal(client, channelId, message);
	if (local) return { messageId: local.id, channelId: local.channelId, local: true };
	if (!client.shard) return null;
	return sendRemote(client, channelId, message);
};

export const editMessage = async (client: discord.Client, channelId: string, messageId: string, payload: string | discord.MessageEditOptions): Promise<boolean> => {
	const channel = client.channels.cache.get(channelId);
	if (channel?.isTextBased()) {
		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message?.editable) return false;
		return message.edit(payload).then(() => true, () => false);
	}

	if (!client.shard) return false;

	const results = await client.shard
		.broadcastEval(
			async (c, context): Promise<boolean> => {
				const target = c.channels.cache.get(context.channelId);
				if (!target?.isTextBased()) return false;
				const message = await target.messages.fetch(context.messageId).catch(() => null);
				if (!message?.editable) return false;
				return message.edit(context.payload as string | discord.MessageEditOptions).then(() => true, () => false);
			},
			{ context: { channelId, messageId, payload } },
		)
		.catch((): boolean[] => []);

	return results.some(Boolean);
};

export const deleteMessage = async (client: discord.Client, channelId: string, messageId: string): Promise<boolean> => {
	const channel = client.channels.cache.get(channelId);
	if (channel?.isTextBased()) {
		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message) return false;
		return message.delete().then(() => true, () => false);
	}

	if (!client.shard) return false;

	const results = await client.shard
		.broadcastEval(
			async (c, context): Promise<boolean> => {
				const target = c.channels.cache.get(context.channelId);
				if (!target?.isTextBased()) return false;
				const message = await target.messages.fetch(context.messageId).catch(() => null);
				if (!message) return false;
				return message.delete().then(() => true, () => false);
			},
			{ context: { channelId, messageId } },
		)
		.catch((): boolean[] => []);

	return results.some(Boolean);
};
