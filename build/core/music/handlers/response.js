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
        this.createActivityCheckEmbed = (locale = 'en') => {
            const title = this.localizationManager.translate('responses.activity_check.title', locale) || '⏰ Are you still listening?';
            const description = this.localizationManager.translate('responses.activity_check.description', locale) || 'Music has been playing for over 6 hours.\n\nClick the button below to continue listening, or the player will be disconnected in 5 minutes.';
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#faa61a')
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
                .setTimestamp();
        };
        this.createActivityCheckConfirmedEmbed = (locale = 'en') => {
            const message = this.localizationManager.translate('responses.activity_check.confirmed', locale) || '✅ Great! Music will continue playing. See you in another 6 hours!';
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#43b581')
                .setDescription(message)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
                .setTimestamp();
        };
        this.createActivityCheckTimeoutEmbed = (locale = 'en') => {
            const message = this.localizationManager.translate('responses.activity_check.timeout', locale) || '⏱️ No response received. The activity check has expired.';
            return new discord_js_1.default.EmbedBuilder()
                .setColor('#f04747')
                .setDescription(message)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() })
                .setTimestamp();
        };
        this.getActivityCheckButton = (disabled = false, locale = 'en') => {
            const label = this.localizationManager.translate('responses.buttons.continue_listening', locale) || 'Continue Listening';
            return new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('activity-check-continue').setLabel(label).setStyle(discord_js_1.default.ButtonStyle.Success).setEmoji('✅').setDisabled(disabled));
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
            const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : format_1.default.msToTime(track.duration);
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(this.localizationManager.translate('responses.music.now_playing', locale))
                .setDescription(`**[${trackTitle}](${trackUri})**\nby ${trackAuthor}`)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
            if (trackImg)
                embed.setThumbnail(trackImg);
            const fields = [{ name: this.localizationManager.translate('responses.fields.duration', locale), value: trackDuration, inline: true }];
            if (track.sourceName)
                fields.push({ name: this.localizationManager.translate('responses.fields.source', locale), value: track.sourceName, inline: true });
            if (requesterData)
                fields.push({ name: this.localizationManager.translate('responses.fields.requested_by', locale), value: requesterData.username, inline: true });
            if (player && !track.isStream) {
                const progress = utils_1.ProgressBarUtils.createBarFromPlayer(player, track.duration);
                if (progress)
                    fields.push({ name: this.localizationManager.translate('responses.fields.progress', locale), value: `${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\``, inline: false });
            }
            embed.addFields(fields);
            return embed;
        };
        this.createTrackEmbed = (track, position, locale = 'en') => {
            const requesterData = track.requester ? (0, func_1.getRequester)(this.client, track.requester) : null;
            const trackImg = track.thumbnail || track.artworkUrl;
            const trackTitle = format_1.default.truncateText(track.title || 'Unknown Title', 60);
            const trackAuthor = track.author || 'Unknown Artist';
            const trackUri = track.uri || 'https://google.com';
            const trackDuration = track.isStream ? this.localizationManager.translate('responses.queue.live', locale) : format_1.default.msToTime(track.duration);
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor('#43b581')
                .setTitle(this.localizationManager.translate('responses.music.track_added', locale))
                .setDescription(`**[${trackTitle}](${trackUri})**\nby ${trackAuthor}`)
                .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
            if (trackImg)
                embed.setThumbnail(trackImg);
            const fields = [{ name: this.localizationManager.translate('responses.fields.duration', locale), value: trackDuration, inline: true }];
            if (track.sourceName)
                fields.push({ name: this.localizationManager.translate('responses.fields.source', locale), value: track.sourceName, inline: true });
            if (position > 0) {
                fields.push({ name: this.localizationManager.translate('responses.fields.queue_info', locale), value: this.localizationManager.translate('responses.fields.position', locale, { position: position + 1 }), inline: true });
            }
            else {
                fields.push({ name: this.localizationManager.translate('responses.fields.queue_info', locale), value: this.localizationManager.translate('responses.fields.playing_next', locale), inline: true });
            }
            if (requesterData)
                fields.push({ name: this.localizationManager.translate('responses.fields.requested_by', locale), value: requesterData.username, inline: true });
            embed.addFields(fields);
            return embed;
        };
        this.createPlaylistEmbed = (playlist, requester, locale = 'en') => {
            if (!playlist) {
                return new discord_js_1.default.EmbedBuilder()
                    .setColor('#f04747')
                    .setDescription('Failed to load playlist')
                    .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
            }
            const playlistName = format_1.default.truncateText(playlist.name || 'Unknown Playlist', 60);
            const trackPreview = playlist.tracks
                .slice(0, 5)
                .map((track, index) => {
                const title = format_1.default.truncateText(track.title || 'Unknown', 40);
                return `**${index + 1}.** ${title}`;
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
