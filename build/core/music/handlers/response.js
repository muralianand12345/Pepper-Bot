"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusicResponseHandler = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const func_1 = require("../func");
const format_1 = __importDefault(require("../../../utils/format"));
const locales_1 = require("../../locales");
class MusicResponseHandler {
    constructor(client) {
        this.trackProgress = (position, duration) => {
            const normalizedPosition = Math.min(position, duration);
            const percentage = normalizedPosition / duration;
            const formattedPosition = format_1.default.msToTime(normalizedPosition);
            const formattedDuration = format_1.default.msToTime(duration);
            return {
                displayPosition: normalizedPosition,
                percentage,
                formattedPosition,
                formattedDuration,
            };
        };
        this.createSuccessEmbed = (message, locale = 'en') => {
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
        this.createInfoEmbed = (message, locale = 'en') => {
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#5865f2')
                .setDescription(`ℹ️ ${message}`)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
        };
        this.createWarningEmbed = (message, locale = 'en') => {
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#faa61a')
                .setDescription(`⚠️ ${message}`)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
        };
        this.createMusicEmbed = (track, player, locale = 'en') => {
            const requesterData = track.requester ? (0, func_1.getRequester)(this.client, track.requester) : null;
            const trackImg = track.thumbnail || track.artworkUrl;
            const trackTitle = format_1.default.truncateText(track.title, 60);
            const trackAuthor = track.author || 'Unknown';
            const trackUri = track.uri || 'https://google.com';
            const defaultColor = '#2b2d31';
            let progressText = '';
            if (player && player.queue && player.queue.current) {
                try {
                    const position = Math.max(0, player.position);
                    const duration = track.duration || 0;
                    const progress = this.trackProgress(position, duration);
                    const length = 15;
                    const filledBlocks = Math.floor(progress.percentage * length);
                    const progressBar = '▬'.repeat(filledBlocks) + '●' + '▬'.repeat(Math.max(0, length - filledBlocks - 1));
                    progressText = `${progressBar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``;
                }
                catch (error) {
                    progressText = '';
                }
            }
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor(defaultColor)
                .setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
                .setDescription(`**${format_1.default.hyperlink(trackTitle, trackUri)}**\nby **${trackAuthor}**`)
                .setThumbnail(trackImg);
            if (progressText) {
                embed.addFields([{ name: this.localizationManager.translate('responses.fields.progress', locale), value: progressText, inline: false }]);
                embed.setFooter({ text: `${track.sourceName || 'Unknown'} • ${requesterData?.username || 'Unknown'}`, iconURL: this.client.user?.displayAvatarURL() }).setTimestamp();
                return embed;
            }
            return embed;
        };
        this.createTrackEmbed = (track, position, locale = 'en') => {
            const requesterData = track.requester ? (0, func_1.getRequester)(this.client, track.requester) : null;
            const title = format_1.default.truncateText(track.title, 60);
            const url = track.uri || 'https://google.com';
            const author = track.author || 'Unknown';
            const duration = track.isStream ? 'LIVE' : format_1.default.msToTime(track.duration);
            let queueInfo = '';
            if (position === 0) {
                queueInfo = this.localizationManager.translate('responses.fields.playing_next', locale);
            }
            else if (position !== null && position !== undefined) {
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
            const playlistName = format_1.default.truncateText(playlist.name || 'Untitled Playlist', 50);
            const trackPreview = playlist.tracks
                .slice(0, 5)
                .map((track, i) => {
                const title = format_1.default.truncateText(track.title, 40);
                return `**${i + 1}.** ${title}`;
            })
                .join('\n');
            const moreTracksText = playlist.tracks.length > 5 ? `\n*...and ${playlist.tracks.length - 5} more tracks*` : '';
            const totalDuration = format_1.default.msToTime(playlist.duration || 0);
            let avgDuration = '0:00:00';
            if (playlist.tracks.length > 0) {
                const avgMs = Math.floor(playlist.duration / playlist.tracks.length);
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
            return new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setLabel(this.localizationManager.translate('responses.buttons.support_server', locale)).setStyle(discord_js_1.default.ButtonStyle.Link).setURL('https://discord.gg/XzE9hSbsNb').setEmoji('🔧'));
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
