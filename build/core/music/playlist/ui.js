"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAddResultContainer = exports.createTransferRequestRow = exports.createTransferRequestContainer = exports.createPlaylistCancelRow = exports.createPlaylistConfirmRow = exports.createPlaylistSearchRow = exports.createPlaylistSearchContainer = exports.createPlaylistShareContainer = exports.createPlaylistListContainer = exports.createPlaylistPageRow = exports.createPlaylistViewContainer = exports.formatPlaylistChoice = exports.lockMessage = exports.premiumHint = exports.visibilityLabel = exports.clampPlaylistPage = exports.getPlaylistPageCount = exports.displayTrackTitle = exports.displayPlaylistName = exports.playlistCustomId = exports.PLAYLIST_CUSTOM_ID_PREFIX = exports.PLAYLIST_ACCENT = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const format_1 = __importDefault(require("../../../utils/format"));
const v2_1 = require("../../../utils/v2");
const service_1 = require("./service");
exports.PLAYLIST_ACCENT = 0x9b59b6;
exports.PLAYLIST_CUSTOM_ID_PREFIX = 'playlist';
const playlistCustomId = (...parts) => [exports.PLAYLIST_CUSTOM_ID_PREFIX, ...parts].join(':');
exports.playlistCustomId = playlistCustomId;
const displayPlaylistName = (name) => discord_js_1.default.escapeMarkdown(name).replace(/@/g, '@​');
exports.displayPlaylistName = displayPlaylistName;
const displayTrackTitle = (title) => discord_js_1.default.escapeMarkdown(format_1.default.truncateText(title, 60));
exports.displayTrackTitle = displayTrackTitle;
const getPlaylistPageCount = (trackCount) => Math.max(1, Math.ceil(trackCount / service_1.PLAYLIST_CONFIG.PAGE_SIZE));
exports.getPlaylistPageCount = getPlaylistPageCount;
const clampPlaylistPage = (page, trackCount) => Math.min(Math.max(Number.isFinite(page) ? Math.floor(page) : 0, 0), (0, exports.getPlaylistPageCount)(trackCount) - 1);
exports.clampPlaylistPage = clampPlaylistPage;
const visibilityLabel = (visibility, t) => (visibility === 'public' ? `🌐 ${t('responses.playlist.visibility.public')}` : `👤 ${t('responses.playlist.visibility.private')}`);
exports.visibilityLabel = visibilityLabel;
const premiumHint = (limits, premium, t) => (limits.isPremium ? undefined : t('responses.playlist.premium_hint', { playlists: premium.playlists, songs: premium.songs }));
exports.premiumHint = premiumHint;
const lockMessage = (lock, trackCount, t) => {
    if (lock.reason === 'too_many_playlists')
        return t('responses.playlist.locked.too_many_playlists', { count: lock.ownedCount, max: lock.limits.playlists });
    if (lock.reason === 'too_many_songs')
        return t('responses.playlist.locked.too_many_songs', { count: trackCount, max: lock.limits.songs });
    return null;
};
exports.lockMessage = lockMessage;
const formatPlaylistChoice = (name, trackCount, maxSongs, locked, suffix) => {
    const count = maxSongs ? `${trackCount}/${maxSongs}` : `${trackCount}`;
    return format_1.default.truncateText(`${locked ? '🔒' : '🎶'} ${name} · ♪ ${count}${suffix ? ` - ${suffix}` : ''}`, 97);
};
exports.formatPlaylistChoice = formatPlaylistChoice;
const formatTrackDuration = (track, t) => (track.isStream ? t('responses.queue.live') : format_1.default.msToTime(track.duration));
const formatPlaylistTrack = (track, position, t) => `**${position}.** **${discord_js_1.default.escapeMarkdown(format_1.default.truncateText(track.title, 40))}** - ${discord_js_1.default.escapeMarkdown(format_1.default.truncateText(track.author, 25))}\n└ ${formatTrackDuration(track, t)}`;
const divider = (container) => container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
const text = (content) => new discord_js_1.default.TextDisplayBuilder().setContent(content);
const createPlaylistViewContainer = (playlist, page, lock, t) => {
    const current = (0, exports.clampPlaylistPage)(page, playlist.tracks.length);
    const totalDuration = playlist.tracks.reduce((total, track) => total + (track.isStream ? 0 : track.duration), 0);
    const details = [`**${t('responses.playlist.fields.owner')}:** <@${playlist.ownerId}>`, `**${t('responses.playlist.fields.code')}:** \`${playlist.code}\``, `**${t('responses.playlist.fields.visibility')}:** ${(0, exports.visibilityLabel)(playlist.visibility, t)}`, `**${t('responses.playlist.fields.songs')}:** ${playlist.tracks.length}/${lock.limits.songs}`, `**${t('responses.playlist.fields.duration')}:** \`${format_1.default.msToTime(totalDuration)}\``];
    const container = (0, v2_1.panel)(exports.PLAYLIST_ACCENT, { title: `🎶 ${(0, exports.displayPlaylistName)(playlist.name)}`, body: details.join('\n'), thumbnail: playlist.tracks[0]?.artworkUrl || null });
    const locked = (0, exports.lockMessage)(lock, playlist.tracks.length, t);
    if (locked)
        divider(container).addTextDisplayComponents(text(`🔒 ${locked}`));
    const start = current * service_1.PLAYLIST_CONFIG.PAGE_SIZE;
    const lines = playlist.tracks.slice(start, start + service_1.PLAYLIST_CONFIG.PAGE_SIZE).map((track, index) => formatPlaylistTrack(track, start + index + 1, t));
    divider(container).addTextDisplayComponents(text(lines.length > 0 ? lines.join('\n\n') : t('responses.playlist.view_empty')));
    container.addTextDisplayComponents(text((0, v2_1.subtext)(t('responses.playlist.page', { page: current + 1, total: (0, exports.getPlaylistPageCount)(playlist.tracks.length) }))));
    return container;
};
exports.createPlaylistViewContainer = createPlaylistViewContainer;
const createPlaylistPageRow = (code, page, trackCount, t) => {
    const totalPages = (0, exports.getPlaylistPageCount)(trackCount);
    if (totalPages <= 1)
        return null;
    const current = (0, exports.clampPlaylistPage)(page, trackCount);
    return new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder()
        .setCustomId((0, exports.playlistCustomId)('page', code, current - 1))
        .setLabel(t('responses.playlist.buttons.previous'))
        .setEmoji('⬅️')
        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
        .setDisabled(current <= 0), new discord_js_1.default.ButtonBuilder()
        .setCustomId((0, exports.playlistCustomId)('page', code, current + 1))
        .setLabel(t('responses.playlist.buttons.next'))
        .setEmoji('➡️')
        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
        .setDisabled(current >= totalPages - 1));
};
exports.createPlaylistPageRow = createPlaylistPageRow;
const createPlaylistListContainer = (summaries, limits, premium, t) => {
    const body = summaries.length === 0
        ? t('responses.playlist.list_empty')
        : summaries
            .map((summary, index) => {
            const locked = service_1.PlaylistService.isSummaryLocked(summary, summaries.length, limits);
            return `**${index + 1}.** ${locked ? '🔒 ' : ''}**${(0, exports.displayPlaylistName)(summary.name)}** · \`${summary.code}\`\n└ ${(0, exports.visibilityLabel)(summary.visibility, t)} • ${t('responses.playlist.song_count', { count: summary.trackCount, max: limits.songs })}`;
        })
            .join('\n\n');
    const container = (0, v2_1.panel)(exports.PLAYLIST_ACCENT, { title: `🎶 ${t('responses.playlist.list_title')}`, body });
    if (summaries.length > limits.playlists)
        divider(container).addTextDisplayComponents(text(`🔒 ${t('responses.playlist.locked.too_many_playlists', { count: summaries.length, max: limits.playlists })}`));
    const footer = [t('responses.playlist.list_limits', { count: summaries.length, max: limits.playlists, songs: limits.songs }), (0, exports.premiumHint)(limits, premium, t)].filter((line) => Boolean(line));
    divider(container).addTextDisplayComponents(text(footer.map(v2_1.subtext).join('\n')));
    return container;
};
exports.createPlaylistListContainer = createPlaylistListContainer;
const createPlaylistShareContainer = (playlist, t) => {
    const key = playlist.visibility === 'public' ? 'responses.playlist.share_public' : 'responses.playlist.share_private';
    return (0, v2_1.panel)(exports.PLAYLIST_ACCENT, { title: `🔗 ${t('responses.playlist.share_title')}`, body: t(key, { name: (0, exports.displayPlaylistName)(playlist.name), owner: `<@${playlist.ownerId}>`, count: playlist.tracks.length, code: playlist.code }), thumbnail: playlist.tracks[0]?.artworkUrl || null });
};
exports.createPlaylistShareContainer = createPlaylistShareContainer;
const createPlaylistSearchContainer = (playlist, tracks, limits, t) => {
    const lines = tracks.map((track, index) => `**${index + 1}.** **${discord_js_1.default.escapeMarkdown(format_1.default.truncateText(track.title, 50))}** - ${discord_js_1.default.escapeMarkdown(format_1.default.truncateText(track.author, 30))} \`${formatTrackDuration(track, t)}\``);
    return (0, v2_1.panel)(exports.PLAYLIST_ACCENT, { title: `➕ ${t('responses.playlist.search.title', { name: (0, exports.displayPlaylistName)(playlist.name) })}`, body: `${t('responses.playlist.search.description')}\n\n${lines.join('\n')}`, footer: t('responses.playlist.song_count', { count: playlist.tracks.length, max: limits.songs }) });
};
exports.createPlaylistSearchContainer = createPlaylistSearchContainer;
const createPlaylistSearchRow = (token, tracks, t) => new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.StringSelectMenuBuilder()
    .setCustomId((0, exports.playlistCustomId)('pick', token))
    .setPlaceholder(t('responses.playlist.search.placeholder'))
    .addOptions(tracks.map((track, index) => new discord_js_1.default.StringSelectMenuOptionBuilder().setLabel(format_1.default.truncateText(track.title, 97)).setDescription(format_1.default.truncateText(`${track.author} • ${formatTrackDuration(track, t)}`, 97)).setValue(String(index)))));
exports.createPlaylistSearchRow = createPlaylistSearchRow;
const createPlaylistConfirmRow = (confirmId, confirmLabel, cancelId, cancelLabel, style = discord_js_1.default.ButtonStyle.Primary) => new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId(confirmId).setLabel(confirmLabel).setStyle(style), new discord_js_1.default.ButtonBuilder().setCustomId(cancelId).setLabel(cancelLabel).setStyle(discord_js_1.default.ButtonStyle.Secondary));
exports.createPlaylistConfirmRow = createPlaylistConfirmRow;
const createPlaylistCancelRow = (token, t) => new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId((0, exports.playlistCustomId)('cancel', token)).setLabel(t('responses.playlist.buttons.cancel')).setStyle(discord_js_1.default.ButtonStyle.Secondary));
exports.createPlaylistCancelRow = createPlaylistCancelRow;
const createTransferRequestContainer = (playlist, from, expiresAt, t) => (0, v2_1.panel)(exports.PLAYLIST_ACCENT, { title: `📨 ${t('responses.playlist.transfer.request_title')}`, body: t('responses.playlist.transfer.request_body', { from: discord_js_1.default.escapeMarkdown(from.username), name: (0, exports.displayPlaylistName)(playlist.name), count: playlist.tracks.length, expires: Math.floor(expiresAt.getTime() / 1000) }), thumbnail: playlist.tracks[0]?.artworkUrl || null });
exports.createTransferRequestContainer = createTransferRequestContainer;
const createTransferRequestRow = (playlist, t) => (0, exports.createPlaylistConfirmRow)((0, exports.playlistCustomId)('transfer-accept', playlist.code, playlist.ownerId), t('responses.playlist.buttons.accept'), (0, exports.playlistCustomId)('transfer-decline', playlist.code, playlist.ownerId), t('responses.playlist.buttons.decline'), discord_js_1.default.ButtonStyle.Success);
exports.createTransferRequestRow = createTransferRequestRow;
const createAddResultContainer = (result, entry, context) => {
    const { responseHandler, premium, t, locale } = context;
    const title = (0, exports.displayTrackTitle)(entry.title);
    switch (result.status) {
        case 'added':
            return responseHandler.createSuccessContainer(t('responses.playlist.add.added', { title, name: (0, exports.displayPlaylistName)(result.playlist.name), count: result.playlist.tracks.length, max: result.limits.songs }));
        case 'duplicate': {
            const container = responseHandler.createWarningContainer(t('responses.playlist.add.duplicate', { title, name: (0, exports.displayPlaylistName)(result.playlist.name) }));
            if (!context.duplicate)
                return container;
            return (0, v2_1.withRows)(container, (0, exports.createPlaylistConfirmRow)((0, exports.playlistCustomId)('dup', context.duplicate.token, context.duplicate.index), t('responses.playlist.buttons.add_anyway'), (0, exports.playlistCustomId)('cancel', context.duplicate.token), t('responses.playlist.buttons.cancel')));
        }
        case 'full':
            return responseHandler.createErrorContainer(t('responses.playlist.add.full', { name: (0, exports.displayPlaylistName)(result.playlist.name), max: result.limits.songs }), locale, false, (0, exports.premiumHint)(result.limits, premium, t));
        case 'locked':
            return responseHandler.createErrorContainer((0, exports.lockMessage)(result.lock, result.playlist.tracks.length, t) ?? t('responses.errors.general_error'), locale, false, (0, exports.premiumHint)(result.lock.limits, premium, t));
        case 'not_owner':
            return responseHandler.createErrorContainer(t('responses.playlist.not_owner'), locale);
        default:
            return responseHandler.createErrorContainer(t('responses.playlist.not_found'), locale);
    }
};
exports.createAddResultContainer = createAddResultContainer;
