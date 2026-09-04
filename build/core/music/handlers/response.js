"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusicResponseHandler = exports.NOW_PLAYING_COMPONENT_ID = exports.PLAYER_STATE = exports.ACCENT = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const func_1 = require("../func");
const utils_1 = require("../utils");
const v2_1 = require("../../../utils/v2");
const format_1 = __importDefault(require("../../../utils/format"));
const locales_1 = require("../../locales");
exports.ACCENT = {
    success: 0x43b581,
    error: 0xf04747,
    info: 0x5865f2,
    warning: 0xfaa61a,
    neutral: 0x2b2d31,
    spotify: 0x1db954,
};
exports.PLAYER_STATE = {
    playing: { accent: 0x1db954, emoji: '▶️', badge: '💿' },
    paused: { accent: 0xfaa61a, emoji: '⏸️', badge: '⏸️' },
    stopped: { accent: 0xed4245, emoji: '⏹️', badge: '⏹️' },
    skipped: { accent: 0x5865f2, emoji: '⏭️', badge: '⏭️' },
    loop: { accent: 0x9b59b6, emoji: '🔁', badge: '🔁' },
    autoplay: { accent: 0x1abc9c, emoji: '♾️', badge: '♾️' },
    shuffle: { accent: 0x3498db, emoji: '🔀', badge: '🔀' },
    filter: { accent: 0xe91e63, emoji: '🎛️', badge: '🎛️' },
    volume: { accent: 0x00b0f4, emoji: '🔊', badge: '🔊' },
    connected: { accent: 0x1db954, emoji: '🔊', badge: '🔊' },
    queued: { accent: 0x43b581, emoji: '➕', badge: '➕' },
    cleared: { accent: 0xed4245, emoji: '🗑️', badge: '🗑️' },
    disconnected: { accent: 0x747f8d, emoji: '🔌', badge: '🔌' },
    idle: { accent: 0x2b2d31, emoji: '⏹️', badge: '💤' },
};
const LEADING_EMOJI = /^\p{Extended_Pictographic}/u;
exports.NOW_PLAYING_COMPONENT_ID = 90;
class MusicResponseHandler {
    constructor(client) {
        this.badge = (state) => {
            const override = this.client.config?.bot?.emoji?.[state];
            return override?.trim() || exports.PLAYER_STATE[state].badge;
        };
        this.statusContainer = (accent, message, footer) => {
            const container = new discord_js_1.default.ContainerBuilder().setAccentColor(accent).addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(message));
            if (footer)
                container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent((0, v2_1.subtext)(footer)));
            return container;
        };
        this.createSuccessContainer = (message, footer) => {
            return this.statusContainer(exports.ACCENT.success, `✓ ${message}`, footer);
        };
        this.createPlayerStateContainer = (state, message, footer) => {
            const { accent, emoji } = exports.PLAYER_STATE[state];
            return this.statusContainer(accent, LEADING_EMOJI.test(message) ? message : `${emoji} ${message}`, footer);
        };
        this.createErrorContainer = (message, locale = 'en', contact_dev = false, footer) => {
            return this.statusContainer(exports.ACCENT.error, `❌ ${message}`, footer ?? (contact_dev ? this.localizationManager.translate('responses.errors.contact_dev', locale) : undefined));
        };
        this.createInfoContainer = (message, footer) => {
            return this.statusContainer(exports.ACCENT.info, `ℹ️ ${message}`, footer);
        };
        this.createWarningContainer = (message, footer) => {
            return this.statusContainer(exports.ACCENT.warning, `⚠️ ${message}`, footer);
        };
        this.createActivityCheckContainer = (locale = 'en') => {
            const title = this.localizationManager.translate('responses.activity_check.title', locale) || '⏰ Are you still listening?';
            const description = this.localizationManager.translate('responses.activity_check.description', locale) || 'Music has been playing for over 6 hours.\n\nClick the button below to continue listening, or the player will be disconnected in 5 minutes.';
            return new discord_js_1.default.ContainerBuilder()
                .setAccentColor(exports.ACCENT.warning)
                .addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`### ${title}`))
                .addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small))
                .addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`${description}\n${(0, v2_1.subtext)(`<t:${Math.floor(Date.now() / 1000)}:R>`)}`));
        };
        this.createActivityCheckConfirmedContainer = (locale = 'en') => {
            const message = this.localizationManager.translate('responses.activity_check.confirmed', locale) || '✅ Great! Music will continue playing. See you in another 6 hours!';
            return this.statusContainer(exports.ACCENT.success, message, `<t:${Math.floor(Date.now() / 1000)}:R>`);
        };
        this.createActivityCheckTimeoutContainer = (locale = 'en') => {
            const message = this.localizationManager.translate('responses.activity_check.timeout', locale) || '⏱️ No response received. The activity check has expired.';
            return this.statusContainer(exports.ACCENT.error, message, `<t:${Math.floor(Date.now() / 1000)}:R>`);
        };
        this.getActivityCheckButton = (disabled = false, locale = 'en') => {
            const label = this.localizationManager.translate('responses.buttons.continue_listening', locale) || 'Continue Listening';
            return new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('activity-check-continue').setLabel(label).setStyle(discord_js_1.default.ButtonStyle.Success).setEmoji('✅').setDisabled(disabled));
        };
        this.detailLines = (entries) => entries.map(([label, value]) => `**${label}:** ${value}`).join('\n');
        this.trackBody = (track, locale) => {
            const trackTitle = format_1.default.truncateText(track.title || 'Unknown Title', 60);
            const trackAuthor = track.author || 'Unknown Artist';
            const trackUri = track.uri || 'https://google.com';
            return `**[${trackTitle}](${trackUri})**\nby ${trackAuthor}`;
        };
        this.addBody = (container, body, thumbnail) => {
            if (thumbnail) {
                container.addSectionComponents(new discord_js_1.default.SectionBuilder().addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(body)).setThumbnailAccessory(new discord_js_1.default.ThumbnailBuilder().setURL(thumbnail)));
                return;
            }
            container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(body));
        };
        this.createMusicContainer = async (track, player, locale = 'en', state) => {
            const resolvedState = state ?? (!player ? 'idle' : player.paused ? 'paused' : player.playing ? 'playing' : 'idle');
            const container = new discord_js_1.default.ContainerBuilder()
                .setId(exports.NOW_PLAYING_COMPONENT_ID)
                .setAccentColor(exports.PLAYER_STATE[resolvedState].accent)
                .addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`### ${this.badge(resolvedState)} ${this.localizationManager.translate('responses.music.now_playing', locale)}`))
                .addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
            if (!track) {
                container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent('**No track available**'));
                return container;
            }
            const requesterData = track.requester ? (0, func_1.getRequester)(this.client, track.requester) : null;
            const trackImg = track.thumbnail || track.artworkUrl;
            const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : format_1.default.msToTime(track.duration);
            const details = [[this.localizationManager.translate('responses.fields.duration', locale), `\`${trackDuration}\``]];
            if (track.sourceName)
                details.push([this.localizationManager.translate('responses.fields.source', locale), `\`${track.sourceName}\``]);
            if (requesterData)
                details.push([this.localizationManager.translate('responses.fields.requested_by', locale), requesterData.username]);
            this.addBody(container, `${this.trackBody(track, locale)}\n\n${this.detailLines(details)}`, trackImg);
            if (player && !track.isStream) {
                const progress = utils_1.ProgressBarUtils.createBarFromPlayer(player, track.duration);
                if (progress) {
                    container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(false).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
                    container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``));
                }
            }
            return container;
        };
        this.createTrackContainer = (track, position, locale = 'en') => {
            const requesterData = track.requester ? (0, func_1.getRequester)(this.client, track.requester) : null;
            const trackImg = track.thumbnail || track.artworkUrl;
            const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : format_1.default.msToTime(track.duration);
            const container = new discord_js_1.default.ContainerBuilder()
                .setAccentColor(exports.PLAYER_STATE.queued.accent)
                .addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`### ${this.badge('queued')} ${this.localizationManager.translate('responses.music.track_added', locale)}`))
                .addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
            const details = [[this.localizationManager.translate('responses.fields.duration', locale), `\`${trackDuration}\``]];
            if (track.sourceName)
                details.push([this.localizationManager.translate('responses.fields.source', locale), `\`${track.sourceName}\``]);
            details.push([this.localizationManager.translate('responses.fields.queue_info', locale), position > 0 ? this.localizationManager.translate('responses.fields.position', locale, { position: position + 1 }) : this.localizationManager.translate('responses.fields.playing_next', locale)]);
            if (requesterData)
                details.push([this.localizationManager.translate('responses.fields.requested_by', locale), requesterData.username]);
            this.addBody(container, `${this.trackBody(track, locale)}\n\n${this.detailLines(details)}`, trackImg);
            return container;
        };
        this.createPlaylistContainer = (playlist, requester, locale = 'en') => {
            if (!playlist)
                return this.statusContainer(exports.ACCENT.error, '❌ Failed to load playlist');
            const playlistName = format_1.default.truncateText(playlist.name || 'Unknown Playlist', 60);
            const trackPreview = playlist.tracks
                .slice(0, 5)
                .map((track, index) => `**${index + 1}.** ${format_1.default.truncateText(track.title || 'Unknown', 40)}`)
                .join('\n');
            const moreTracksText = playlist.tracks.length > 5 ? `\n*...and ${playlist.tracks.length - 5} more tracks*` : '';
            const totalDuration = format_1.default.msToTime(playlist.duration || 0);
            const avgDuration = playlist.tracks.length > 0 ? format_1.default.msToTime(Math.floor((playlist.duration || 0) / playlist.tracks.length)) : '0:00:00';
            const container = new discord_js_1.default.ContainerBuilder()
                .setAccentColor(exports.PLAYER_STATE.queued.accent)
                .addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`### ${this.badge('queued')} ${this.localizationManager.translate('responses.music.playlist_added', locale)}`))
                .addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
            const details = [
                [this.localizationManager.translate('responses.fields.tracks', locale), `\`${playlist.tracks.length}\``],
                [this.localizationManager.translate('responses.fields.total_duration', locale), `\`${totalDuration}\``],
                [this.localizationManager.translate('responses.fields.avg_duration', locale), `\`${avgDuration}\``],
                [this.localizationManager.translate('responses.fields.added_by', locale), requester.tag || 'Unknown'],
            ];
            this.addBody(container, `**${playlistName}**\n\n${this.detailLines(details)}`, playlist.tracks[0]?.artworkUrl || playlist.tracks[0]?.thumbnail || null);
            container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(false).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
            container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`**Preview:**\n${trackPreview}${moreTracksText}`));
            return container;
        };
        this.getSupportButton = (locale = 'en') => {
            return new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setLabel(this.localizationManager.translate('responses.buttons.support_server', locale)).setStyle(discord_js_1.default.ButtonStyle.Link).setURL(this.client.config.bot.support_server.invite).setEmoji('🔧'));
        };
        this.getMusicButton = (disabled = false, locale = 'en') => {
            const row = new discord_js_1.default.ActionRowBuilder();
            const buttonConfig = [
                { id: 'pause-music', labelKey: 'responses.buttons.pause', emoji: '⏸️' },
                { id: 'resume-music', labelKey: 'responses.buttons.resume', emoji: '▶️' },
                { id: 'skip-music', labelKey: 'responses.buttons.skip', emoji: '⏭️' },
                { id: 'stop-music', labelKey: 'responses.buttons.stop', emoji: '⏹️' },
                { id: 'loop-music', labelKey: 'responses.buttons.loop', emoji: '🔄' },
            ];
            buttonConfig.forEach(({ id, labelKey, emoji }) => {
                row.addComponents(new discord_js_1.default.ButtonBuilder().setCustomId(id).setLabel(this.localizationManager.translate(labelKey, locale)).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji(emoji).setDisabled(disabled));
            });
            return row;
        };
        this.client = client;
        this.localizationManager = locales_1.LocalizationManager.getInstance();
    }
}
exports.MusicResponseHandler = MusicResponseHandler;
