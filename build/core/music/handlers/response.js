"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusicResponseHandler = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const func_1 = require("../func");
const utils_1 = require("../utils");
const format_1 = __importDefault(require("../../../utils/format"));
const locales_1 = require("../../locales");
class MusicResponseHandler {
    constructor(client) {
        this.createSuccessEmbed = (message) => {
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#43b581')
                .setDescription(`✓ ${message}`)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
        };
        this.createErrorEmbed = (message, locale = 'en', contact_dev = false) => {
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor('#f04747')
                .setDescription(`❌ ${message}`)
                .setFooter({
                text: contact_dev ? this.localizationManager.translate('responses.errors.contact_dev', locale) : this.client.user?.username || 'Music Bot',
                iconURL: this.client.user?.displayAvatarURL(),
            });
            return embed;
        };
        this.createInfoEmbed = (message) => {
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#5865f2')
                .setDescription(`ℹ️ ${message}`)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
        };
        this.createWarningEmbed = (message) => {
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#faa61a')
                .setDescription(`⚠️ ${message}`)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
        };
        this.createMusicEmbed = async (track, player, locale = 'en') => {
            if (!track)
                return new discord_js_1.default.EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
                    .setDescription('**No track available**')
                    .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
            const requesterData = track.requester ? (0, func_1.getRequester)(this.client, track.requester) : null;
            const trackImg = track.thumbnail || track.artworkUrl;
            const trackTitle = format_1.default.truncateText(track.title || 'Unknown Title', 60);
            const trackAuthor = track.author || 'Unknown Artist';
            const trackUri = track.uri || 'https://google.com';
            const trackDuration = track.isStream ? 'LIVE' : format_1.default.msToTime(track.duration || 0);
            const defaultColor = '#2b2d31';
            let progressText = '';
            if (player && player.queue && (await player.queue.getCurrent()) && track.duration) {
                try {
                    const progress = utils_1.ProgressBarUtils.createBarFromPlayer(player, track.duration);
                    if (progress)
                        progressText = `${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``;
                }
                catch (error) {
                    this.client.logger?.warn(`[MUSIC_EMBED] Error creating progress bar: ${error}`);
                    progressText = '';
                }
            }
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor(defaultColor)
                .setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
                .setDescription(`**${format_1.default.hyperlink(trackTitle, trackUri)}**\nby **${trackAuthor}**`);
            if (trackImg)
                embed.setThumbnail(trackImg);
            if (progressText)
                embed.addFields({ name: this.localizationManager.translate('responses.fields.progress', locale), value: progressText, inline: false });
            embed.addFields({ name: this.localizationManager.translate('responses.fields.duration', locale), value: trackDuration, inline: true }, { name: this.localizationManager.translate('responses.fields.source', locale), value: track.sourceName || 'Unknown', inline: true }, { name: this.localizationManager.translate('responses.fields.requested_by', locale), value: requesterData?.username || 'Unknown', inline: true });
            embed.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() }).setTimestamp();
            return embed;
        };
        this.createTrackEmbed = (track, position, locale = 'en') => {
            if (!track) {
                return new discord_js_1.default.EmbedBuilder()
                    .setColor('#f04747')
                    .setTitle('Error')
                    .setDescription('Invalid track data')
                    .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
            }
            const title = format_1.default.truncateText(track.title || 'Unknown Title', 60);
            const url = track.uri || 'https://google.com';
            const author = track.author || 'Unknown Artist';
            let queueInfo = '';
            if (position === 0) {
                queueInfo = this.localizationManager.translate('responses.fields.playing_next', locale);
            }
            else if (position !== null && position !== undefined) {
                queueInfo = this.localizationManager.translate('responses.fields.position', locale, { position: position + 1 });
            }
            const fields = [];
            if (queueInfo)
                fields.push({ name: this.localizationManager.translate('responses.fields.queue_info', locale), value: queueInfo, inline: false });
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#5865f2')
                .setTitle(this.localizationManager.translate('responses.music.track_added', locale))
                .setDescription(`**${format_1.default.hyperlink(title, url)}**\nby ${author}`)
                .setThumbnail(track.artworkUrl || track.thumbnail || null)
                .addFields(fields)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
                .setTimestamp();
        };
        this.createPlaylistEmbed = (playlist, requester, locale = 'en') => {
            if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
                return new discord_js_1.default.EmbedBuilder()
                    .setColor('#f04747')
                    .setTitle('Error')
                    .setDescription('Invalid playlist data')
                    .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
            }
            const playlistName = format_1.default.truncateText(playlist.name || 'Untitled Playlist', 50);
            const trackPreview = playlist.tracks
                .slice(0, 5)
                .map((track, i) => {
                const title = format_1.default.truncateText(track.title || 'Unknown Title', 40);
                return `**${i + 1}.** ${title}`;
            })
                .join('\n');
            const moreTracksText = playlist.tracks.length > 5 ? `\n*...and ${playlist.tracks.length - 5} more tracks*` : '';
            const totalDuration = format_1.default.msToTime(playlist.duration || 0);
            let avgDuration = '0:00:00';
            if (playlist.tracks.length > 0) {
                const avgMs = Math.floor((playlist.duration || 0) / playlist.tracks.length);
                avgDuration = format_1.default.msToTime(avgMs);
            }
            return new discord_js_1.default.EmbedBuilder()
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
