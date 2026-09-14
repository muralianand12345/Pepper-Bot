import discord from 'discord.js';

import Formatter from '../../../utils/format';
import { TranslatorFunction } from '../../locales';
import { MusicResponseHandler } from '../handlers';
import { panel, subtext, withRows } from '../../../utils/v2';
import { IPlaylistTrack, PlaylistRecord, PlaylistSummary, PlaylistVisibility } from '../../../types';
import { PLAYLIST_CONFIG, PlaylistAddResult, PlaylistLimits, PlaylistLock, PlaylistService } from './service';

export const PLAYLIST_ACCENT = 0x9b59b6;
export const PLAYLIST_CUSTOM_ID_PREFIX = 'playlist';

export const playlistCustomId = (...parts: (string | number)[]): string => [PLAYLIST_CUSTOM_ID_PREFIX, ...parts].join(':');

export const displayPlaylistName = (name: string): string => discord.escapeMarkdown(name).replace(/@/g, '@​');

export const displayTrackTitle = (title: string): string => discord.escapeMarkdown(Formatter.truncateText(title, 60));

export const getPlaylistPageCount = (trackCount: number): number => Math.max(1, Math.ceil(trackCount / PLAYLIST_CONFIG.PAGE_SIZE));

export const clampPlaylistPage = (page: number, trackCount: number): number => Math.min(Math.max(Number.isFinite(page) ? Math.floor(page) : 0, 0), getPlaylistPageCount(trackCount) - 1);

export const visibilityLabel = (visibility: PlaylistVisibility, t: TranslatorFunction): string => (visibility === 'public' ? `🌐 ${t('responses.playlist.visibility.public')}` : `👤 ${t('responses.playlist.visibility.private')}`);

export const premiumHint = (limits: PlaylistLimits, premium: PlaylistLimits, t: TranslatorFunction): string | undefined => (limits.isPremium ? undefined : t('responses.playlist.premium_hint', { playlists: premium.playlists, songs: premium.songs }));

export const lockMessage = (lock: PlaylistLock, trackCount: number, t: TranslatorFunction): string | null => {
	if (lock.reason === 'too_many_playlists') return t('responses.playlist.locked.too_many_playlists', { count: lock.ownedCount, max: lock.limits.playlists });
	if (lock.reason === 'too_many_songs') return t('responses.playlist.locked.too_many_songs', { count: trackCount, max: lock.limits.songs });
	return null;
};

export const formatPlaylistChoice = (name: string, trackCount: number, maxSongs: number | null, locked: boolean, suffix?: string): string => {
	const count = maxSongs ? `${trackCount}/${maxSongs}` : `${trackCount}`;
	return Formatter.truncateText(`${locked ? '🔒' : '🎶'} ${name} · ♪ ${count}${suffix ? ` - ${suffix}` : ''}`, 97);
};

const formatTrackDuration = (track: IPlaylistTrack, t: TranslatorFunction): string => (track.isStream ? t('responses.queue.live') : Formatter.msToTime(track.duration));

const formatPlaylistTrack = (track: IPlaylistTrack, position: number, t: TranslatorFunction): string => `**${position}.** **${discord.escapeMarkdown(Formatter.truncateText(track.title, 40))}** - ${discord.escapeMarkdown(Formatter.truncateText(track.author, 25))}\n└ ${formatTrackDuration(track, t)}`;

const divider = (container: discord.ContainerBuilder): discord.ContainerBuilder => container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));

const text = (content: string): discord.TextDisplayBuilder => new discord.TextDisplayBuilder().setContent(content);

export const createPlaylistViewContainer = (playlist: PlaylistRecord, page: number, lock: PlaylistLock, t: TranslatorFunction): discord.ContainerBuilder => {
	const current = clampPlaylistPage(page, playlist.tracks.length);
	const totalDuration = playlist.tracks.reduce((total, track) => total + (track.isStream ? 0 : track.duration), 0);
	const details = [`**${t('responses.playlist.fields.owner')}:** <@${playlist.ownerId}>`, `**${t('responses.playlist.fields.code')}:** \`${playlist.code}\``, `**${t('responses.playlist.fields.visibility')}:** ${visibilityLabel(playlist.visibility, t)}`, `**${t('responses.playlist.fields.songs')}:** ${playlist.tracks.length}/${lock.limits.songs}`, `**${t('responses.playlist.fields.duration')}:** \`${Formatter.msToTime(totalDuration)}\``];

	const container = panel(PLAYLIST_ACCENT, { title: `🎶 ${displayPlaylistName(playlist.name)}`, body: details.join('\n'), thumbnail: playlist.tracks[0]?.artworkUrl || null });

	const locked = lockMessage(lock, playlist.tracks.length, t);
	if (locked) divider(container).addTextDisplayComponents(text(`🔒 ${locked}`));

	const start = current * PLAYLIST_CONFIG.PAGE_SIZE;
	const lines = playlist.tracks.slice(start, start + PLAYLIST_CONFIG.PAGE_SIZE).map((track, index) => formatPlaylistTrack(track, start + index + 1, t));
	divider(container).addTextDisplayComponents(text(lines.length > 0 ? lines.join('\n\n') : t('responses.playlist.view_empty')));
	container.addTextDisplayComponents(text(subtext(t('responses.playlist.page', { page: current + 1, total: getPlaylistPageCount(playlist.tracks.length) }))));
	return container;
};

export const createPlaylistPageRow = (code: string, page: number, trackCount: number, t: TranslatorFunction): discord.ActionRowBuilder<discord.ButtonBuilder> | null => {
	const totalPages = getPlaylistPageCount(trackCount);
	if (totalPages <= 1) return null;

	const current = clampPlaylistPage(page, trackCount);
	return new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
		new discord.ButtonBuilder()
			.setCustomId(playlistCustomId('page', code, current - 1))
			.setLabel(t('responses.playlist.buttons.previous'))
			.setEmoji('⬅️')
			.setStyle(discord.ButtonStyle.Secondary)
			.setDisabled(current <= 0),
		new discord.ButtonBuilder()
			.setCustomId(playlistCustomId('page', code, current + 1))
			.setLabel(t('responses.playlist.buttons.next'))
			.setEmoji('➡️')
			.setStyle(discord.ButtonStyle.Secondary)
			.setDisabled(current >= totalPages - 1),
	);
};

export const createPlaylistListContainer = (summaries: PlaylistSummary[], limits: PlaylistLimits, premium: PlaylistLimits, t: TranslatorFunction): discord.ContainerBuilder => {
	const body =
		summaries.length === 0
			? t('responses.playlist.list_empty')
			: summaries
					.map((summary, index) => {
						const locked = PlaylistService.isSummaryLocked(summary, summaries.length, limits);
						return `**${index + 1}.** ${locked ? '🔒 ' : ''}**${displayPlaylistName(summary.name)}** · \`${summary.code}\`\n└ ${visibilityLabel(summary.visibility, t)} • ${t('responses.playlist.song_count', { count: summary.trackCount, max: limits.songs })}`;
					})
					.join('\n\n');

	const container = panel(PLAYLIST_ACCENT, { title: `🎶 ${t('responses.playlist.list_title')}`, body });

	if (summaries.length > limits.playlists) divider(container).addTextDisplayComponents(text(`🔒 ${t('responses.playlist.locked.too_many_playlists', { count: summaries.length, max: limits.playlists })}`));

	const footer = [t('responses.playlist.list_limits', { count: summaries.length, max: limits.playlists, songs: limits.songs }), premiumHint(limits, premium, t)].filter((line): line is string => Boolean(line));
	divider(container).addTextDisplayComponents(text(footer.map(subtext).join('\n')));
	return container;
};

export const createPlaylistShareContainer = (playlist: PlaylistRecord, t: TranslatorFunction): discord.ContainerBuilder => {
	const key = playlist.visibility === 'public' ? 'responses.playlist.share_public' : 'responses.playlist.share_private';
	return panel(PLAYLIST_ACCENT, { title: `🔗 ${t('responses.playlist.share_title')}`, body: t(key, { name: displayPlaylistName(playlist.name), owner: `<@${playlist.ownerId}>`, count: playlist.tracks.length, code: playlist.code }), thumbnail: playlist.tracks[0]?.artworkUrl || null });
};

export const createPlaylistSearchContainer = (playlist: PlaylistRecord, tracks: IPlaylistTrack[], limits: PlaylistLimits, t: TranslatorFunction): discord.ContainerBuilder => {
	const lines = tracks.map((track, index) => `**${index + 1}.** **${discord.escapeMarkdown(Formatter.truncateText(track.title, 50))}** - ${discord.escapeMarkdown(Formatter.truncateText(track.author, 30))} \`${formatTrackDuration(track, t)}\``);
	return panel(PLAYLIST_ACCENT, { title: `➕ ${t('responses.playlist.search.title', { name: displayPlaylistName(playlist.name) })}`, body: `${t('responses.playlist.search.description')}\n\n${lines.join('\n')}`, footer: t('responses.playlist.song_count', { count: playlist.tracks.length, max: limits.songs }) });
};

export const createPlaylistSearchRow = (token: string, tracks: IPlaylistTrack[], t: TranslatorFunction): discord.ActionRowBuilder<discord.StringSelectMenuBuilder> =>
	new discord.ActionRowBuilder<discord.StringSelectMenuBuilder>().addComponents(
		new discord.StringSelectMenuBuilder()
			.setCustomId(playlistCustomId('pick', token))
			.setPlaceholder(t('responses.playlist.search.placeholder'))
			.addOptions(tracks.map((track, index) => new discord.StringSelectMenuOptionBuilder().setLabel(Formatter.truncateText(track.title, 97)).setDescription(Formatter.truncateText(`${track.author} • ${formatTrackDuration(track, t)}`, 97)).setValue(String(index)))),
	);

export const createPlaylistConfirmRow = (confirmId: string, confirmLabel: string, cancelId: string, cancelLabel: string, style: discord.ButtonStyle = discord.ButtonStyle.Primary): discord.ActionRowBuilder<discord.ButtonBuilder> =>
	new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId(confirmId).setLabel(confirmLabel).setStyle(style), new discord.ButtonBuilder().setCustomId(cancelId).setLabel(cancelLabel).setStyle(discord.ButtonStyle.Secondary));

export const createPlaylistCancelRow = (token: string, t: TranslatorFunction): discord.ActionRowBuilder<discord.ButtonBuilder> =>
	new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId(playlistCustomId('cancel', token)).setLabel(t('responses.playlist.buttons.cancel')).setStyle(discord.ButtonStyle.Secondary));

export const createTransferRequestContainer = (playlist: PlaylistRecord, from: discord.User, expiresAt: Date, t: TranslatorFunction): discord.ContainerBuilder =>
	panel(PLAYLIST_ACCENT, { title: `📨 ${t('responses.playlist.transfer.request_title')}`, body: t('responses.playlist.transfer.request_body', { from: discord.escapeMarkdown(from.username), name: displayPlaylistName(playlist.name), count: playlist.tracks.length, expires: Math.floor(expiresAt.getTime() / 1000) }), thumbnail: playlist.tracks[0]?.artworkUrl || null });

export const createTransferRequestRow = (playlist: PlaylistRecord, t: TranslatorFunction): discord.ActionRowBuilder<discord.ButtonBuilder> => createPlaylistConfirmRow(playlistCustomId('transfer-accept', playlist.code, playlist.ownerId), t('responses.playlist.buttons.accept'), playlistCustomId('transfer-decline', playlist.code, playlist.ownerId), t('responses.playlist.buttons.decline'), discord.ButtonStyle.Success);

export const createAddResultContainer = (result: PlaylistAddResult, entry: IPlaylistTrack, context: { responseHandler: MusicResponseHandler; premium: PlaylistLimits; t: TranslatorFunction; locale: string; duplicate?: { token: string; index: number } }): discord.ContainerBuilder => {
	const { responseHandler, premium, t, locale } = context;
	const title = displayTrackTitle(entry.title);

	switch (result.status) {
		case 'added':
			return responseHandler.createSuccessContainer(t('responses.playlist.add.added', { title, name: displayPlaylistName(result.playlist.name), count: result.playlist.tracks.length, max: result.limits.songs }));
		case 'duplicate': {
			const container = responseHandler.createWarningContainer(t('responses.playlist.add.duplicate', { title, name: displayPlaylistName(result.playlist.name) }));
			if (!context.duplicate) return container;
			return withRows(container, createPlaylistConfirmRow(playlistCustomId('dup', context.duplicate.token, context.duplicate.index), t('responses.playlist.buttons.add_anyway'), playlistCustomId('cancel', context.duplicate.token), t('responses.playlist.buttons.cancel')));
		}
		case 'full':
			return responseHandler.createErrorContainer(t('responses.playlist.add.full', { name: displayPlaylistName(result.playlist.name), max: result.limits.songs }), locale, false, premiumHint(result.limits, premium, t));
		case 'locked':
			return responseHandler.createErrorContainer(lockMessage(result.lock, result.playlist.tracks.length, t) ?? t('responses.errors.general_error'), locale, false, premiumHint(result.lock.limits, premium, t));
		case 'not_owner':
			return responseHandler.createErrorContainer(t('responses.playlist.not_owner'), locale);
		default:
			return responseHandler.createErrorContainer(t('responses.playlist.not_found'), locale);
	}
};
