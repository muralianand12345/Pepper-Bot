import discord from 'discord.js';
import timers from 'timers/promises';
import magmastream from 'magmastream';

import { ISongsUser } from '../../types';

export const sendTempMessage = async (channel: discord.TextChannel, embed: discord.EmbedBuilder, duration: number = 10000): Promise<void> => {
	if (!channel.isTextBased()) throw new Error('Channel is not text-based');

	const message = await channel.send({ embeds: [embed] }).catch((error) => {
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
		if (cachedUser) user = cachedUser;
		else return { id: String(user), username: 'Unknown', discriminator: '0000', avatar: undefined };
	}

	if (user instanceof discord.ClientUser) return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar || undefined };
	if (user instanceof discord.User) return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatarURL() || undefined };

	try {
		const anyUser: any = user as any;
		const id = anyUser?.id ?? anyUser?.userId ?? anyUser?._id;
		const username = anyUser?.username ?? anyUser?.tag ?? 'Unknown';
		const discriminator = typeof anyUser?.discriminator === 'string' ? anyUser.discriminator : '0000';
		const avatar = typeof anyUser?.avatar === 'string' ? anyUser.avatar : anyUser?.avatarURL ?? undefined;

		if (id) {
			return {
				id: String(id),
				username: String(username),
				discriminator: String(discriminator),
				avatar: typeof avatar === 'string' ? avatar : undefined,
			};
		}
	} catch {}

	return { id: String((user as any)?.id ?? ''), username: 'Unknown', discriminator: '0000', avatar: undefined };
};
