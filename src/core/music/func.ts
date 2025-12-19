import discord from 'discord.js';
import timers from 'timers/promises';
import magmastream from 'magmastream';

import { send } from '../../utils/msg';
import { ISongsUser } from '../../types';

export const sendTempMessage = async (channel: discord.TextChannel, embed: discord.EmbedBuilder, duration: number = 10000): Promise<void> => {
	if (!channel.isTextBased()) throw new Error('Channel is not text-based');

	const message = await send(channel.client, channel.id, { embeds: [embed] }).catch((error) => {
		if (error.code === 50001) return null;
		return null;
	});

	if (!message) return;

	setTimeout(() => {
		message.delete().catch((deleteError) => {
			if (deleteError.code !== 10008) {
			}
		});
	}, duration);
};

export const wait = async (ms: number): Promise<void> => {
	await timers.setTimeout(ms);
};

export const getRequester = (client: discord.Client, user: discord.User | discord.ClientUser | magmastream.PortableUser | string | null): ISongsUser | null => {
	if (!user) return null;

	if (typeof user === 'string') {
		const cachedUser = client.users.cache.get(user);
		if (cachedUser) return { id: cachedUser.id, username: cachedUser.username, discriminator: cachedUser.discriminator, avatar: cachedUser.avatarURL() || undefined };
		return { id: user, username: 'Unknown', discriminator: '0000', avatar: undefined };
	}

	if (user instanceof discord.ClientUser) return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar || undefined };
	if (user instanceof discord.User) return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatarURL() || undefined };

	return { id: user.id, username: user.username ?? 'Unknown', discriminator: '0000', avatar: undefined };
};
