import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import Formatter from '../../../../utils/format';
import { LavalinkEvent } from '../../../../types';
import { ConfigManager } from '../../../../utils/config';
import { LocaleDetector } from '../../../../core/locales';
import { MusicResponseHandler } from '../../../../core/music/handlers/response';
import { wait, MusicDB, NowPlayingManager, getRequester } from '../../../../core/music';

const YTREGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const localeDetector = new LocaleDetector();
const configManager = ConfigManager.getInstance();

const logTrackStart = (track: magmastream.Track, player: magmastream.Player, client: discord.Client): void => {
	const guildName = client.guilds.cache.get(player.guildId)?.name;
	const requesterData = track.requester ? getRequester(client, track.requester) : null;
	if (!requesterData) return client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId})`);
	client.logger.info(`[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) ` + `By ${requesterData.username} (${requesterData.id})`);
	client.logger.info(`[LAVALINK] User: ${requesterData.username} (${requesterData.id}) requested song uri ${track.uri} ` + `in ${guildName} (${player.guildId}) using Node ${player.node.options.identifier} (${player.node.options.host}:${player.node.options.port || ''})`);
};

const webhookLiveSongs = async (client: discord.Client, track: magmastream.Track, player: magmastream.Player): Promise<void> => {
	try {
		const webhookUrl = configManager.getLiveSongsWebhook();
		if (!webhookUrl) return client.logger.warn('[LAVALINK] Live songs webhook URL not configured.');

		const webhookClient = new discord.WebhookClient({ url: webhookUrl });
		if (!webhookClient) return client.logger.error('[LAVALINK] Live songs webhook client not found.');

		const guild = client.guilds.cache.get(player.guildId);
		const duration = track.isStream ? 'LIVE STREAM' : Formatter.msToTime(track.duration);
		const voiceChannel = guild?.channels.cache.get(player.voiceChannelId || '') as discord.VoiceBasedChannel;
		const voiceMembers = voiceChannel?.members.filter((member) => !member.user.bot).size || 0;

		const embed = new discord.EmbedBuilder()
			.setColor('#FF0000')
			.setTitle('🎵 Now Playing Live')
			.setDescription(`**${track.title || 'Unknown Track'}**\nby **${track.author || 'Unknown Artist'}**`)
			.setThumbnail(track.artworkUrl || track.thumbnail || null)
			.addFields([
				{ name: '⏱️ Duration', value: duration, inline: true },
				{ name: '📻 Source', value: track.sourceName || 'Unknown', inline: true },
				{ name: '🔊 Listening', value: `${voiceMembers}`, inline: true },
				{ name: '🌐 Node', value: player.node.options.identifier || 'Unknown Node', inline: true },
				{ name: '🆔 Track ID', value: track.identifier || 'Unknown', inline: true },
			])
			.setFooter({ text: `${client.user?.username || 'Music Bot'} • Live Song Activity`, iconURL: client.user?.displayAvatarURL() })
			.setTimestamp();

		if (track.uri && !track.uri.includes('youtube')) embed.setURL(track.uri);

		await webhookClient.send({
			username: `${client.user?.username || 'Music Bot'} Live Songs`,
			avatarURL: client.user?.displayAvatarURL(),
			embeds: [embed],
		});

		client.logger.debug(`[LAVALINK] Live song activity sent for ${track.title} in ${guild?.name}`);
	} catch (error) {
		client.logger.error(`[LAVALINK] Failed to send live song webhook: ${error}`);
	}
};

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.TrackStart,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackStartEvent, client: discord.Client) => {
		if (!player?.textChannelId || !client?.channels) return;

		try {
			const channel = (await client.channels.fetch(player.textChannelId)) as discord.TextChannel;
			if (!channel?.isTextBased()) return;

			let guildLocale = 'en';
			try {
				guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
			} catch (error) {}

			const requesterData = track.requester ? getRequester(client, track.requester) : null;
			if (YTREGEX.test(track.uri)) {
				const isFromPlaylist = player.queue && player.queue.size > 0;

				if (!isFromPlaylist) {
					player.stop(1);
					client.logger.warn(`[LAVALINK] Skipping YouTube track: ${track.uri}`);
					const responseHandler = new MusicResponseHandler(client);
					const embed = responseHandler.createWarningEmbed(client.localizationManager?.translate('responses.music.youtube_blocked', guildLocale) || '⚠️ Skipping song! Youtube source detected.', guildLocale).setFooter({ text: client.localizationManager?.translate('responses.music.youtube_footer', guildLocale) || "We do not support Youtube links due to YouTube's TOS.", iconURL: client.user?.displayAvatarURL() || '' });
					return await channel.send({ embeds: [embed] }).then((msg) => wait(5000).then(() => msg.delete().catch((err) => client.logger.error(`[LAVALINK] Failed to delete message: ${err}`))));
				} else {
					client.logger.info(`[LAVALINK] Playing YouTube track from playlist: ${track.title}`);
				}
			}

			const songData = {
				track: track.title,
				artworkUrl: track.artworkUrl || '',
				sourceName: track.sourceName || 'unknown',
				title: track.title || 'Unknown',
				identifier: track.identifier || `unknown_${Date.now()}`,
				author: track.author || 'Unknown',
				duration: track.duration || 0,
				isrc: track.isrc || '',
				isSeekable: track.isSeekable !== undefined ? track.isSeekable : true,
				isStream: track.isStream !== undefined ? track.isStream : false,
				uri: track.uri || '',
				thumbnail: track.thumbnail || null,
				requester: requesterData,
				played_number: 1,
				timestamp: new Date(),
			};

			await MusicDB.addMusicUserData(requesterData?.id || null, songData);
			await MusicDB.addMusicGuildData(player.guildId, songData);

			logTrackStart(track, player, client);

			try {
				NowPlayingManager.removeInstance(player.guildId);
				const nowPlayingManager = NowPlayingManager.getInstance(player.guildId, player, client);
				await nowPlayingManager.updateOrCreateMessage(channel, track);
				client.logger.debug(`[LAVALINK] Now playing message created/updated for ${track.title}`);
			} catch (nowPlayingError) {
				client.logger.error(`[LAVALINK] Failed to create/update now playing message: ${nowPlayingError}`);
			}

			try {
				await webhookLiveSongs(client, track, player);
			} catch (webhookError) {
				client.logger.error(`[LAVALINK] Failed to send live songs webhook: ${webhookError}`);
			}
		} catch (error) {
			client.logger.error(`[TRACK_START] Error in trackStart event: ${error}`);
		}
	},
};

export default lavalinkEvent;
