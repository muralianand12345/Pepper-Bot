import discord from 'discord.js';
import timers from 'timers/promises';
import magmastream from 'magmastream';

import { sendRef, deleteMessage } from '../../utils/msg';
import { ISongsUser } from '../../types';
import { v2 } from '../../utils/v2';

export const sendTempMessage = async (channel: discord.TextChannel, container: discord.ContainerBuilder, duration: number = 10000): Promise<void> => {
	if (!channel.isTextBased()) throw new Error('Channel is not text-based');

	const ref = await sendRef(channel.client, channel.id, v2(container)).catch(() => null);

	if (!ref) return;

	setTimeout(() => {
		deleteMessage(channel.client, ref.channelId, ref.messageId).catch(() => {});
	}, duration);
};

export const wait = async (ms: number): Promise<void> => {
	await timers.setTimeout(ms);
};

export const isBotRequester = (client: discord.Client, requester: ISongsUser | string | null): boolean => {
	const id = typeof requester === 'string' ? requester : requester?.id;
	if (!id) return false;
	if (client.user?.id === id) return true;
	return client.users.cache.get(id)?.bot ?? false;
};

export const getRequester = (client: discord.Client, user: magmastream.AnyUser | string | null): ISongsUser | null => {
	if (!user) return null;

	if (typeof user === 'string') {
		const cachedUser = client.users.cache.get(user);
		if (cachedUser) return { id: cachedUser.id, username: cachedUser.username, discriminator: cachedUser.discriminator, avatar: cachedUser.avatarURL() || undefined };
		return { id: user, username: 'Unknown', discriminator: '0000', avatar: undefined };
	}

	if (user instanceof discord.ClientUser) return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar || undefined };
	if (user instanceof discord.User) return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatarURL() || undefined };

	// A restored player deserialises its requester from session data, so this is a plain
	// object rather than a real PortableUser and the id can be missing despite the type.
	// Persisting `{ id: undefined }` fails the schema's required id, so drop it instead.
	const { id, username } = (user ?? {}) as Partial<magmastream.PortableUser>;
	if (typeof id !== 'string' || id.length === 0) return null;
	return { id, username: username ?? 'Unknown', discriminator: '0000', avatar: undefined };
};
