import discord from 'discord.js';
import magmastream from 'magmastream';

import { getRequester } from '../func';
import { ProgressBarUtils } from '../utils';
import { subtext } from '../../../utils/v2';
import Formatter from '../../../utils/format';
import { LocalizationManager } from '../../locales';

/** Accent colours for the container's left edge — the Components V2 stand-in for an embed colour. */
export const ACCENT = {
	success: 0x43b581,
	error: 0xf04747,
	info: 0x5865f2,
	warning: 0xfaa61a,
	neutral: 0x2b2d31,
	spotify: 0x1db954,
} as const;

/**
 * Accent colour and glyph per player action, so a card reads as the state it represents
 * before a word of it is read: green while playing, amber paused, red stopped.
 */
export const PLAYER_STATE = {
	playing: { accent: 0x1db954, emoji: '▶️' },
	paused: { accent: 0xfaa61a, emoji: '⏸️' },
	stopped: { accent: 0xed4245, emoji: '⏹️' },
	skipped: { accent: 0x5865f2, emoji: '⏭️' },
	loop: { accent: 0x9b59b6, emoji: '🔁' },
	autoplay: { accent: 0x1abc9c, emoji: '♾️' },
	shuffle: { accent: 0x3498db, emoji: '🔀' },
	filter: { accent: 0xe91e63, emoji: '🎛️' },
	volume: { accent: 0x00b0f4, emoji: '🔊' },
	connected: { accent: 0x1db954, emoji: '🔊' },
	queued: { accent: 0x43b581, emoji: '➕' },
	cleared: { accent: 0xed4245, emoji: '🗑️' },
	disconnected: { accent: 0x747f8d, emoji: '🔌' },
	idle: { accent: 0x2b2d31, emoji: '⏹️' },
} as const;

export type PlayerState = keyof typeof PLAYER_STATE;

/** Several locale strings already lead with their own emoji; don't stack a second one on. */
const LEADING_EMOJI = /^\p{Extended_Pictographic}/u;

/**
 * Explicit component id stamped on the now playing container so old now playing
 * messages can still be found and cleaned up — Components V2 messages carry no
 * embeds, so the previous "match the embed title" lookup no longer works.
 */
export const NOW_PLAYING_COMPONENT_ID = 90;

export class MusicResponseHandler {
	private readonly client: discord.Client;
	private localizationManager: LocalizationManager;

	constructor(client: discord.Client) {
		this.client = client;
		this.localizationManager = LocalizationManager.getInstance();
	}

	private statusContainer = (accent: number, message: string, footer?: string): discord.ContainerBuilder => {
		const container = new discord.ContainerBuilder().setAccentColor(accent).addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(message));
		if (footer) container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(subtext(footer)));
		return container;
	};

	public createSuccessContainer = (message: string, footer?: string): discord.ContainerBuilder => {
		return this.statusContainer(ACCENT.success, `✓ ${message}`, footer);
	};

	/** A confirmation coloured and badged by the player action it reports. */
	public createPlayerStateContainer = (state: PlayerState, message: string, footer?: string): discord.ContainerBuilder => {
		const { accent, emoji } = PLAYER_STATE[state];
		return this.statusContainer(accent, LEADING_EMOJI.test(message) ? message : `${emoji} ${message}`, footer);
	};

	public createErrorContainer = (message: string, locale: string = 'en', contact_dev: boolean = false, footer?: string): discord.ContainerBuilder => {
		return this.statusContainer(ACCENT.error, `❌ ${message}`, footer ?? (contact_dev ? this.localizationManager.translate('responses.errors.contact_dev', locale) : undefined));
	};

	public createInfoContainer = (message: string, footer?: string): discord.ContainerBuilder => {
		return this.statusContainer(ACCENT.info, `ℹ️ ${message}`, footer);
	};

	public createWarningContainer = (message: string, footer?: string): discord.ContainerBuilder => {
		return this.statusContainer(ACCENT.warning, `⚠️ ${message}`, footer);
	};

	public createActivityCheckContainer = (locale: string = 'en'): discord.ContainerBuilder => {
		const title = this.localizationManager.translate('responses.activity_check.title', locale) || '⏰ Are you still listening?';
		const description = this.localizationManager.translate('responses.activity_check.description', locale) || 'Music has been playing for over 6 hours.\n\nClick the button below to continue listening, or the player will be disconnected in 5 minutes.';

		return new discord.ContainerBuilder()
			.setAccentColor(ACCENT.warning)
			.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`### ${title}`))
			.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small))
			.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`${description}\n${subtext(`<t:${Math.floor(Date.now() / 1000)}:R>`)}`));
	};

	public createActivityCheckConfirmedContainer = (locale: string = 'en'): discord.ContainerBuilder => {
		const message = this.localizationManager.translate('responses.activity_check.confirmed', locale) || '✅ Great! Music will continue playing. See you in another 6 hours!';
		return this.statusContainer(ACCENT.success, message, `<t:${Math.floor(Date.now() / 1000)}:R>`);
	};

	public createActivityCheckTimeoutContainer = (locale: string = 'en'): discord.ContainerBuilder => {
		const message = this.localizationManager.translate('responses.activity_check.timeout', locale) || '⏱️ No response received. The activity check has expired.';
		return this.statusContainer(ACCENT.error, message, `<t:${Math.floor(Date.now() / 1000)}:R>`);
	};

	public getActivityCheckButton = (disabled: boolean = false, locale: string = 'en'): discord.ActionRowBuilder<discord.ButtonBuilder> => {
		const label = this.localizationManager.translate('responses.buttons.continue_listening', locale) || 'Continue Listening';

		return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('activity-check-continue').setLabel(label).setStyle(discord.ButtonStyle.Success).setEmoji('✅').setDisabled(disabled));
	};

	/**
	 * Renders track metadata the way the old embed's inline fields did. Components V2
	 * has no column layout, so the labelled values are stacked one per line instead.
	 */
	private detailLines = (entries: [string, string][]): string => entries.map(([label, value]) => `**${label}:** ${value}`).join('\n');

	private trackBody = (track: magmastream.Track, locale: string): string => {
		const trackTitle = Formatter.truncateText(track.title || 'Unknown Title', 60);
		const trackAuthor = track.author || 'Unknown Artist';
		const trackUri = track.uri || 'https://google.com';
		return `**[${trackTitle}](${trackUri})**\nby ${trackAuthor}`;
	};

	private addBody = (container: discord.ContainerBuilder, body: string, thumbnail?: string | null): void => {
		if (thumbnail) {
			container.addSectionComponents(new discord.SectionBuilder().addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(body)).setThumbnailAccessory(new discord.ThumbnailBuilder().setURL(thumbnail)));
			return;
		}
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(body));
	};

	public createMusicContainer = async (track: magmastream.Track | null, player?: magmastream.Player, locale: string = 'en', state?: PlayerState): Promise<discord.ContainerBuilder> => {
		const resolvedState: PlayerState = state ?? (!player ? 'idle' : player.paused ? 'paused' : player.playing ? 'playing' : 'idle');

		const container = new discord.ContainerBuilder()
			.setId(NOW_PLAYING_COMPONENT_ID)
			.setAccentColor(PLAYER_STATE[resolvedState].accent)
			.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`### ${this.localizationManager.translate('responses.music.now_playing', locale)}`))
			.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));

		if (!track) {
			container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent('**No track available**'));
			return container;
		}

		const requesterData = track.requester ? getRequester(this.client, track.requester) : null;
		const trackImg = track.thumbnail || track.artworkUrl;
		const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : Formatter.msToTime(track.duration);

		const details: [string, string][] = [[this.localizationManager.translate('responses.fields.duration', locale), `\`${trackDuration}\``]];
		if (track.sourceName) details.push([this.localizationManager.translate('responses.fields.source', locale), `\`${track.sourceName}\``]);
		if (requesterData) details.push([this.localizationManager.translate('responses.fields.requested_by', locale), requesterData.username]);

		this.addBody(container, `${this.trackBody(track, locale)}\n\n${this.detailLines(details)}`, trackImg);

		if (player && !track.isStream) {
			const progress = ProgressBarUtils.createBarFromPlayer(player, track.duration);
			if (progress) {
				container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(false).setSpacing(discord.SeparatorSpacingSize.Small));
				container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``));
			}
		}

		return container;
	};

	public createTrackContainer = (track: magmastream.Track, position: number, locale: string = 'en'): discord.ContainerBuilder => {
		const requesterData = track.requester ? getRequester(this.client, track.requester) : null;
		const trackImg = track.thumbnail || track.artworkUrl;
		const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : Formatter.msToTime(track.duration);

		const container = new discord.ContainerBuilder()
			.setAccentColor(PLAYER_STATE.queued.accent)
			.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`### ${this.localizationManager.translate('responses.music.track_added', locale)}`))
			.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));

		const details: [string, string][] = [[this.localizationManager.translate('responses.fields.duration', locale), `\`${trackDuration}\``]];
		if (track.sourceName) details.push([this.localizationManager.translate('responses.fields.source', locale), `\`${track.sourceName}\``]);
		details.push([this.localizationManager.translate('responses.fields.queue_info', locale), position > 0 ? this.localizationManager.translate('responses.fields.position', locale, { position: position + 1 }) : this.localizationManager.translate('responses.fields.playing_next', locale)]);
		if (requesterData) details.push([this.localizationManager.translate('responses.fields.requested_by', locale), requesterData.username]);

		this.addBody(container, `${this.trackBody(track, locale)}\n\n${this.detailLines(details)}`, trackImg);
		return container;
	};

	public createPlaylistContainer = (playlist: magmastream.PlaylistData | null, requester: discord.User, locale: string = 'en'): discord.ContainerBuilder => {
		if (!playlist) return this.statusContainer(ACCENT.error, '❌ Failed to load playlist');

		const playlistName = Formatter.truncateText(playlist.name || 'Unknown Playlist', 60);
		const trackPreview = playlist.tracks
			.slice(0, 5)
			.map((track, index) => `**${index + 1}.** ${Formatter.truncateText(track.title || 'Unknown', 40)}`)
			.join('\n');
		const moreTracksText = playlist.tracks.length > 5 ? `\n*...and ${playlist.tracks.length - 5} more tracks*` : '';
		const totalDuration = Formatter.msToTime(playlist.duration || 0);
		const avgDuration = playlist.tracks.length > 0 ? Formatter.msToTime(Math.floor((playlist.duration || 0) / playlist.tracks.length)) : '0:00:00';

		const container = new discord.ContainerBuilder()
			.setAccentColor(PLAYER_STATE.queued.accent)
			.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`### ${this.localizationManager.translate('responses.music.playlist_added', locale)}`))
			.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));

		const details: [string, string][] = [
			[this.localizationManager.translate('responses.fields.tracks', locale), `\`${playlist.tracks.length}\``],
			[this.localizationManager.translate('responses.fields.total_duration', locale), `\`${totalDuration}\``],
			[this.localizationManager.translate('responses.fields.avg_duration', locale), `\`${avgDuration}\``],
			[this.localizationManager.translate('responses.fields.added_by', locale), requester.tag || 'Unknown'],
		];

		this.addBody(container, `**${playlistName}**\n\n${this.detailLines(details)}`, playlist.tracks[0]?.artworkUrl || playlist.tracks[0]?.thumbnail || null);
		container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(false).setSpacing(discord.SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`**Preview:**\n${trackPreview}${moreTracksText}`));
		return container;
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
