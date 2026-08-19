import discord from 'discord.js';
import timers from 'timers/promises';
import magmastream from 'magmastream';

import { sendRef, deleteMessage } from '../../utils/msg';
import { ISongsUser } from '../../types';

export const sendTempMessage = async (channel: discord.TextChannel, embed: discord.EmbedBuilder, duration: number = 10000): Promise<void> => {
	if (!channel.isTextBased()) throw new Error('Channel is not text-based');

	const ref = await sendRef(channel.client, channel.id, { embeds: [embed] }).catch(() => null);

	if (!ref) return;

	setTimeout(() => {
		deleteMessage(channel.client, ref.channelId, ref.messageId).catch(() => {});
	}, duration);
};

export const wait = async (ms: number): Promise<void> => {
	await timers.setTimeout(ms);
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

	const { id, username } = user as magmastream.PortableUser;
	return { id, username: username ?? 'Unknown', discriminator: '0000', avatar: undefined };
};
