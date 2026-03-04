import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { send } from '../../../../utils/msg';
import { LavalinkEvent } from '../../../../types';
import { MUSIC_CONFIG, MusicResponseHandler } from '../../../../core/music';
import music_guild from '../../../../events/database/schema/music_guild';

const reconnectTwentyFourSevenGuilds = async (client: discord.Client): Promise<void> => {
	try {
		const guilds = await music_guild.find({
			twentyFourSeven: true,
			voiceChannelId: { $ne: null },
			textChannelId: { $ne: null },
		});

		if (!guilds.length) return;

		client.logger.info(`[24/7_RECONNECT] Found ${guilds.length} guild(s) with 24/7 mode, attempting reconnect...`);

		for (const guildData of guilds) {
			try {
				const guild = client.guilds.cache.get(guildData.guildId);
				if (!guild) {
					client.logger.warn(`[24/7_RECONNECT] Guild ${guildData.guildId} not in cache, skipping`);
					continue;
				}

				const existingPlayer = client.manager.getPlayer(guildData.guildId);
				if (existingPlayer && existingPlayer.state === 'CONNECTED') {
					client.logger.debug(`[24/7_RECONNECT] Player already connected for guild ${guildData.guildId}, skipping`);
					continue;
				}

				const voiceChannel = client.channels.cache.get(guildData.voiceChannelId!) as discord.VoiceBasedChannel;
				if (!voiceChannel || !voiceChannel.isVoiceBased()) {
					client.logger.warn(`[24/7_RECONNECT] Voice channel ${guildData.voiceChannelId} not found for guild ${guildData.guildId}, clearing stored channels`);
					guildData.voiceChannelId = null;
					guildData.textChannelId = null;
					await guildData.save();
					continue;
				}

				const botMember = guild.members.me;
				if (!botMember) continue;

				const permissions = voiceChannel.permissionsFor(botMember);
				if (!permissions || !permissions.has([discord.PermissionsBitField.Flags.Connect, discord.PermissionsBitField.Flags.Speak])) {
					client.logger.warn(`[24/7_RECONNECT] Missing permissions for voice channel ${voiceChannel.name} in guild ${guild.name}`);
					continue;
				}

				const textChannel = client.channels.cache.get(guildData.textChannelId!) as discord.TextChannel;
				if (!textChannel || !textChannel.isTextBased()) {
					client.logger.warn(`[24/7_RECONNECT] Text channel ${guildData.textChannelId} not found for guild ${guildData.guildId}`);
					continue;
				}

				const player = client.manager.create({
					guildId: guildData.guildId,
					voiceChannelId: voiceChannel.id,
					textChannelId: textChannel.id,
					...MUSIC_CONFIG.PLAYER_OPTIONS,
				});

				player.connect();

				client.logger.success(`[24/7_RECONNECT] Reconnected to ${voiceChannel.name} in ${guild.name}`);

				const responseHandler = new MusicResponseHandler(client);
				const embed = responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.twenty_four_seven_reconnected', 'en') || '🔄 24/7 mode: Reconnected after restart');
				await send(client, textChannel.id, { embeds: [embed] }).catch((err) => client.logger.warn(`[24/7_RECONNECT] Failed to send reconnect message: ${err}`));
			} catch (error) {
				client.logger.error(`[24/7_RECONNECT] Failed to reconnect guild ${guildData.guildId}: ${error}`);
			}
		}
	} catch (error) {
		client.logger.error(`[24/7_RECONNECT] Error during 24/7 reconnect: ${error}`);
	}
};

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.NodeConnect,
	execute: async (node: magmastream.Node, client: discord.Client) => {
		client.logger.success(`[LAVALINK] Node ${node.options.identifier} connected`);
		await reconnectTwentyFourSevenGuilds(client);
	},
};

export default lavalinkEvent;
