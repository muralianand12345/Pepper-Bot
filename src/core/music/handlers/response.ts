import discord from 'discord.js';
import magmastream from 'magmastream';

import { getRequester } from '../func';
import Formatter from '../../../utils/format';
import { ITrackProgress } from '../../../types';
import { LocalizationManager } from '../../locales';

export class MusicResponseHandler {
	private readonly client: discord.Client;
	private localizationManager: LocalizationManager;

	constructor(client: discord.Client) {
		this.client = client;
		this.localizationManager = LocalizationManager.getInstance();
	}

	private trackProgress = (position: number, duration: number): ITrackProgress => {
		const normalizedPosition = Math.min(position, duration);
		const percentage = normalizedPosition / duration;
		const formattedPosition = Formatter.msToTime(normalizedPosition);
		const formattedDuration = Formatter.msToTime(duration);

		return {
			displayPosition: normalizedPosition,
			percentage,
			formattedPosition,
			formattedDuration,
		};
	};

	public createSuccessEmbed = (message: string, locale: string = 'en'): discord.EmbedBuilder => {
		return new discord.EmbedBuilder()
			.setColor('#43b581')
			.setDescription(`✓ ${message}`)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
	};

	public createErrorEmbed = (message: string, locale: string = 'en', contact_dev: boolean = false): discord.EmbedBuilder => {
		const embed = new discord.EmbedBuilder()
			.setColor('#f04747')
			.setDescription(`❌ ${message}`)
			.setFooter({
				text: contact_dev ? this.localizationManager.translate('responses.errors.contact_dev', locale) : this.client.user?.username || 'Music Bot',
				iconURL: this.client.user?.displayAvatarURL(),
			});

		return embed;
	};

	public createInfoEmbed = (message: string, locale: string = 'en'): discord.EmbedBuilder => {
		return new discord.EmbedBuilder()
			.setColor('#5865f2')
			.setDescription(`ℹ️ ${message}`)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
	};

	public createWarningEmbed = (message: string, locale: string = 'en'): discord.EmbedBuilder => {
		return new discord.EmbedBuilder()
			.setColor('#faa61a')
			.setDescription(`⚠️ ${message}`)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
	};

	public createMusicEmbed = async (track: magmastream.Track | null, player?: magmastream.Player, locale: string = 'en'): Promise<discord.EmbedBuilder> => {
		if (!track) {
			return new discord.EmbedBuilder()
				.setColor('#2b2d31')
				.setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
				.setDescription('**No track available**')
				.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
		}

		const requesterData = track.requester ? getRequester(this.client, track.requester) : null;
		const trackImg = track.thumbnail || track.artworkUrl;
		const trackTitle = Formatter.truncateText(track.title || 'Unknown Title', 60);
		const trackAuthor = track.author || 'Unknown Artist';
		const trackUri = track.uri || 'https://google.com';
		const defaultColor: discord.ColorResolvable = '#2b2d31';
		let progressText = '';

		if (player && player.queue && (await player.queue.getCurrent()) && track.duration) {
			try {
				const position = Math.max(0, player.position || 0);
				const duration = track.duration || 0;
				if (duration > 0) {
					const progress = this.trackProgress(position, duration);
					const length = 15;
					const filledBlocks = Math.floor(progress.percentage * length);
					const progressBar = '▬'.repeat(filledBlocks) + '●' + '▬'.repeat(Math.max(0, length - filledBlocks - 1));

					progressText = `${progressBar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``;
				}
			} catch (error) {
				this.client.logger?.warn(`[MUSIC_EMBED] Error creating progress bar: ${error}`);
				progressText = '';
			}
		}

		const embed = new discord.EmbedBuilder()
			.setColor(defaultColor)
			.setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
			.setDescription(`**${Formatter.hyperlink(trackTitle, trackUri)}**\nby **${trackAuthor}**`);

		if (trackImg) {
			embed.setThumbnail(trackImg);
		}

		if (progressText) {
			embed.addFields([{ name: this.localizationManager.translate('responses.fields.progress', locale), value: progressText, inline: false }]);
			embed.setFooter({ text: `-> ${player?.node?.options?.identifier || this.client.user?.username}`, iconURL: this.client.user?.displayAvatarURL() }).setTimestamp();
		} else {
			embed.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
		}

		return embed;
	};

	public createTrackEmbed = (track: magmastream.Track, position?: number | null, locale: string = 'en'): discord.EmbedBuilder => {
		if (!track) {
			return new discord.EmbedBuilder()
				.setColor('#f04747')
				.setTitle('Error')
				.setDescription('Invalid track data')
				.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
		}

		const requesterData = track.requester ? getRequester(this.client, track.requester) : null;
		const title = Formatter.truncateText(track.title || 'Unknown Title', 60);
		const url = track.uri || 'https://google.com';
		const author = track.author || 'Unknown Artist';
		const duration = track.isStream ? 'LIVE' : Formatter.msToTime(track.duration || 0);

		let queueInfo = '';
		if (position === 0) {
			queueInfo = this.localizationManager.translate('responses.fields.playing_next', locale);
		} else if (position !== null && position !== undefined) {
			queueInfo = this.localizationManager.translate('responses.fields.position', locale, { position: position + 1 });
		}

		const fields = [
			{ name: this.localizationManager.translate('responses.fields.duration', locale), value: duration, inline: true },
			{ name: this.localizationManager.translate('responses.fields.source', locale), value: track.sourceName || 'Unknown', inline: true },
			{ name: this.localizationManager.translate('responses.fields.requested_by', locale), value: requesterData?.username || 'Unknown', inline: true },
		];

		if (queueInfo) {
			fields.push({
				name: this.localizationManager.translate('responses.fields.queue_info', locale),
				value: queueInfo,
				inline: false,
			});
		}

		return new discord.EmbedBuilder()
			.setColor('#5865f2')
			.setTitle(this.localizationManager.translate('responses.music.track_added', locale))
			.setDescription(`**${Formatter.hyperlink(title, url)}**\nby ${author}`)
			.setThumbnail(track.artworkUrl || track.thumbnail || null)
			.addFields(fields)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
			.setTimestamp();
	};

	public createPlaylistEmbed = (playlist: magmastream.PlaylistData, requester: discord.User, locale: string = 'en'): discord.EmbedBuilder => {
		if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
			return new discord.EmbedBuilder()
				.setColor('#f04747')
				.setTitle('Error')
				.setDescription('Invalid playlist data')
				.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
		}

		const playlistName = Formatter.truncateText(playlist.name || 'Untitled Playlist', 50);
		const trackPreview = playlist.tracks
			.slice(0, 5)
			.map((track, i) => {
				const title = Formatter.truncateText(track.title || 'Unknown Title', 40);
				return `**${i + 1}.** ${title}`;
			})
			.join('\n');
		const moreTracksText = playlist.tracks.length > 5 ? `\n*...and ${playlist.tracks.length - 5} more tracks*` : '';
		const totalDuration = Formatter.msToTime(playlist.duration || 0);
		let avgDuration = '0:00:00';
		if (playlist.tracks.length > 0) {
			const avgMs = Math.floor((playlist.duration || 0) / playlist.tracks.length);
			avgDuration = Formatter.msToTime(avgMs);
		}

		return new discord.EmbedBuilder()
			.setColor('#43b581')
			.setTitle(this.localizationManager.translate('responses.music.playlist_added', locale))
			.setDescription(`**${playlistName}**\n\n**Preview:**\n${trackPreview}${moreTracksText}`)
			.setThumbnail(playlist.tracks[0]?.artworkUrl || playlist.tracks[0]?.thumbnail || null)
			.addFields([
				{ name: this.localizationManager.translate('responses.fields.tracks', locale), value: `${playlist.tracks.length}`, inline: true },
				{ name: this.localizationManager.translate('responses.fields.total_duration', locale), value: totalDuration, inline: true },
				{ name: this.localizationManager.translate('responses.fields.avg_duration', locale), value: avgDuration, inline: true },
				{ name: this.localizationManager.translate('responses.fields.added_by', locale), value: requester.tag || 'Unknown', inline: false },
			])
			.setFooter({ text: `Playlist loaded successfully`, iconURL: this.client.user?.displayAvatarURL() })
			.setTimestamp();
	};

	public getSupportButton = (locale: string = 'en'): discord.ActionRowBuilder<discord.ButtonBuilder> => {
		return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setLabel(this.localizationManager.translate('responses.buttons.support_server', locale)).setStyle(discord.ButtonStyle.Link).setURL('https://discord.gg/XzE9hSbsNb').setEmoji('🔧'));
	};

	public getMusicButton = (disabled: boolean = false, locale: string = 'en'): discord.ActionRowBuilder<discord.ButtonBuilder> => {
		const row = new discord.ActionRowBuilder<discord.ButtonBuilder>();
		const buttonConfig = [
			{ id: 'pause-music', labelKey: 'responses.buttons.pause', emoji: '⏸️' },
			{ id: 'resume-music', labelKey: 'responses.buttons.resume', emoji: '▶️' },
			{ id: 'skip-music', labelKey: 'responses.buttons.skip', emoji: '⏭️' },
			{ id: 'stop-music', labelKey: 'responses.buttons.stop', emoji: '⏹️' },
			{ id: 'loop-music', labelKey: 'responses.buttons.loop', emoji: '🔄' },
		];

		buttonConfig.forEach(({ id, labelKey, emoji }) => {
			row.addComponents(new discord.ButtonBuilder().setCustomId(id).setLabel(this.localizationManager.translate(labelKey, locale)).setStyle(discord.ButtonStyle.Secondary).setEmoji(emoji).setDisabled(disabled));
		});

		return row;
	};
}
