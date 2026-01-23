import discord from 'discord.js';
import magmastream from 'magmastream';

import { getRequester } from '../func';
import { ProgressBarUtils } from '../utils';
import Formatter from '../../../utils/format';
import { LocalizationManager } from '../../locales';

export class MusicResponseHandler {
	private readonly client: discord.Client;
	private localizationManager: LocalizationManager;

	constructor(client: discord.Client) {
		this.client = client;
		this.localizationManager = LocalizationManager.getInstance();
	}

	public createSuccessEmbed = (message: string): discord.EmbedBuilder => {
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

	public createInfoEmbed = (message: string): discord.EmbedBuilder => {
		return new discord.EmbedBuilder()
			.setColor('#5865f2')
			.setDescription(`ℹ️ ${message}`)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
	};

	public createWarningEmbed = (message: string): discord.EmbedBuilder => {
		return new discord.EmbedBuilder()
			.setColor('#faa61a')
			.setDescription(`⚠️ ${message}`)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
	};

	public createActivityCheckEmbed = (locale: string = 'en'): discord.EmbedBuilder => {
		const title = this.localizationManager.translate('responses.activity_check.title', locale) || '⏰ Are you still listening?';
		const description = this.localizationManager.translate('responses.activity_check.description', locale) || 'Music has been playing for over 6 hours.\n\nClick the button below to continue listening, or the player will be disconnected in 5 minutes.';

		return new discord.EmbedBuilder()
			.setColor('#faa61a')
			.setTitle(title)
			.setDescription(description)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
			.setTimestamp();
	};

	public createActivityCheckConfirmedEmbed = (locale: string = 'en'): discord.EmbedBuilder => {
		const message = this.localizationManager.translate('responses.activity_check.confirmed', locale) || '✅ Great! Music will continue playing. See you in another 6 hours!';

		return new discord.EmbedBuilder()
			.setColor('#43b581')
			.setDescription(message)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
			.setTimestamp();
	};

	public createActivityCheckTimeoutEmbed = (locale: string = 'en'): discord.EmbedBuilder => {
		const message = this.localizationManager.translate('responses.activity_check.timeout', locale) || '⏱️ No response received. The activity check has expired.';

		return new discord.EmbedBuilder()
			.setColor('#f04747')
			.setDescription(message)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
			.setTimestamp();
	};

	public getActivityCheckButton = (disabled: boolean = false, locale: string = 'en'): discord.ActionRowBuilder<discord.ButtonBuilder> => {
		const label = this.localizationManager.translate('responses.buttons.continue_listening', locale) || 'Continue Listening';

		return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('activity-check-continue').setLabel(label).setStyle(discord.ButtonStyle.Success).setEmoji('✅').setDisabled(disabled));
	};

	public createMusicEmbed = async (track: magmastream.Track | null, player?: magmastream.Player, locale: string = 'en'): Promise<discord.EmbedBuilder> => {
		if (!track)
			return new discord.EmbedBuilder()
				.setColor('#2b2d31')
				.setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
				.setDescription('**No track available**')
				.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });

		const requesterData = track.requester ? getRequester(this.client, track.requester) : null;
		const trackImg = track.thumbnail || track.artworkUrl;
		const trackTitle = Formatter.truncateText(track.title || 'Unknown Title', 60);
		const trackAuthor = track.author || 'Unknown Artist';
		const trackUri = track.uri || 'https://google.com';
		const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : Formatter.msToTime(track.duration);

		const embed = new discord.EmbedBuilder()
			.setColor('#2b2d31')
			.setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
			.setDescription(`**[${trackTitle}](${trackUri})**\nby ${trackAuthor}`)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });

		if (trackImg) embed.setThumbnail(trackImg);

		const fields: discord.APIEmbedField[] = [{ name: this.localizationManager.translate('responses.fields.duration', locale), value: trackDuration, inline: true }];

		if (track.sourceName) fields.push({ name: this.localizationManager.translate('responses.fields.source', locale), value: track.sourceName, inline: true });
		if (requesterData) fields.push({ name: this.localizationManager.translate('responses.fields.requested_by', locale), value: requesterData.username, inline: true });

		if (player && !track.isStream) {
			const progress = ProgressBarUtils.createBarFromPlayer(player, track.duration);
			if (progress) fields.push({ name: this.localizationManager.translate('responses.fields.progress', locale), value: `${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``, inline: false });
		}

		embed.addFields(fields);
		return embed;
	};

	public createTrackEmbed = (track: magmastream.Track, position: number, locale: string = 'en'): discord.EmbedBuilder => {
		const requesterData = track.requester ? getRequester(this.client, track.requester) : null;
		const trackImg = track.thumbnail || track.artworkUrl;
		const trackTitle = Formatter.truncateText(track.title || 'Unknown Title', 60);
		const trackAuthor = track.author || 'Unknown Artist';
		const trackUri = track.uri || 'https://google.com';
		const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : Formatter.msToTime(track.duration);

		const embed = new discord.EmbedBuilder()
			.setColor('#43b581')
			.setTitle(this.localizationManager.translate('responses.music.track_added', locale))
			.setDescription(`**[${trackTitle}](${trackUri})**\nby ${trackAuthor}`)
			.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });

		if (trackImg) embed.setThumbnail(trackImg);

		const fields: discord.APIEmbedField[] = [{ name: this.localizationManager.translate('responses.fields.duration', locale), value: trackDuration, inline: true }];

		if (track.sourceName) fields.push({ name: this.localizationManager.translate('responses.fields.source', locale), value: track.sourceName, inline: true });

		if (position > 0) {
			fields.push({ name: this.localizationManager.translate('responses.fields.queue_info', locale), value: this.localizationManager.translate('responses.fields.position', locale, { position: position + 1 }), inline: true });
		} else {
			fields.push({ name: this.localizationManager.translate('responses.fields.queue_info', locale), value: this.localizationManager.translate('responses.fields.playing_next', locale), inline: true });
		}

		if (requesterData) fields.push({ name: this.localizationManager.translate('responses.fields.requested_by', locale), value: requesterData.username, inline: true });

		embed.addFields(fields);
		return embed;
	};

	public createPlaylistEmbed = (playlist: magmastream.PlaylistData | null, requester: discord.User, locale: string = 'en'): discord.EmbedBuilder => {
		if (!playlist) {
			return new discord.EmbedBuilder()
				.setColor('#f04747')
				.setDescription('Failed to load playlist')
				.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
		}

		const playlistName = Formatter.truncateText(playlist.name || 'Unknown Playlist', 60);
		const trackPreview = playlist.tracks
			.slice(0, 5)
			.map((track, index) => {
				const title = Formatter.truncateText(track.title || 'Unknown', 40);
				return `**${index + 1}.** ${title}`;
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
		return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setLabel(this.localizationManager.translate('responses.buttons.support_server', locale)).setStyle(discord.ButtonStyle.Link).setURL(this.client.config.bot.support_server.invite).setEmoji('🔧'));
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
