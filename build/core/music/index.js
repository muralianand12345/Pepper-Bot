"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Music = exports.MUSIC_CONFIG = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = __importStar(require("magmastream"));
const format_1 = __importDefault(require("../../utils/format"));
const utils_1 = require("./utils");
const locales_1 = require("../locales");
const music_guild_1 = __importDefault(require("../../events/database/schema/music_guild"));
const handlers_1 = require("./handlers");
__exportStar(require("./func"), exports);
__exportStar(require("./repo"), exports);
__exportStar(require("./utils"), exports);
__exportStar(require("./search"), exports);
__exportStar(require("./handlers"), exports);
__exportStar(require("./now_playing"), exports);
exports.MUSIC_CONFIG = {
    ERROR_SEARCH_TEXT: 'Unable To Fetch Results',
    DEFAULT_SEARCH_TEXT: 'Please enter a song name or url',
    AUDIO_FILTERS: {
        clear: { name: 'Clear', emoji: '🔄', description: 'Remove all filters' },
        bassboost: { name: 'Bass Boost', emoji: '🔊', description: 'Enhance the bass frequencies' },
        nightcore: { name: 'Nightcore', emoji: '🎵', description: 'Speed up and pitch the audio' },
        vaporwave: { name: 'Vaporwave', emoji: '🌊', description: 'Slow down and lower the pitch' },
        pop: { name: 'Pop', emoji: '🎤', description: 'Enhance vocals and mids' },
        soft: { name: 'Soft', emoji: '🕊️', description: 'Gentle, smooth sound' },
        treblebass: { name: 'Treble Bass', emoji: '📊', description: 'Enhance both highs and lows' },
        eightd: { name: '8D Audio', emoji: '🎧', description: 'Spatial rotating effect' },
        karaoke: { name: 'Karaoke', emoji: '🎤', description: 'Reduce vocals for karaoke' },
        vibrato: { name: 'Vibrato', emoji: '〰️', description: 'Add vibrato effect' },
        tremolo: { name: 'Tremolo', emoji: '📳', description: 'Add tremolo effect' },
    },
    PLAYER_OPTIONS: {
        volume: 50,
        selfDeafen: true,
    },
};
class Music {
    constructor(client, interaction) {
        this.ytRegex = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
        this.locale = 'en';
        this.t = (key) => key;
        this.isDeferred = false;
        this.initializeLocale = async () => {
            this.locale = await this.localeDetector.detectLocale(this.interaction);
            this.t = await this.localeDetector.getTranslator(this.interaction);
        };
        this.validateMusicEnabled = () => {
            if (this.client.config.music.enabled)
                return null;
            return new handlers_1.MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.music_disabled'), this.locale);
        };
        this.validateFilterName = (filterName) => {
            return filterName in exports.MUSIC_CONFIG.AUDIO_FILTERS;
        };
        this.lavaSearch = async (query, retry = 5) => {
            let res;
            res = await this.client.manager.search(query, this.interaction.user.id);
            if (magmastream_1.TrackUtils.isErrorOrEmptySearchResult(res) && retry > 0) {
                this.client.logger.warn(`[MUSIC] Error searching songs. Retrying... (${retry} attempts left)`);
                return this.lavaSearch(query, retry - 1);
            }
            return res;
        };
        this.ytToSpotifyQuery = async (query) => {
            if (query && this.ytRegex.test(query)) {
                const ytSearch = await this.lavaSearch(query, 5);
                if (ytSearch.loadType === 'error')
                    return null;
                if ('tracks' in ytSearch && ytSearch.tracks.length > 0) {
                    const firstTrack = ytSearch.tracks[0];
                    return `spsearch:${firstTrack.title} ${firstTrack.author}`;
                }
                return null;
            }
            return query;
        };
        this.searchResults = async (res, player) => {
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            switch (res.loadType) {
                case 'empty': {
                    const currentTrack = await player.queue.getCurrent();
                    if (!currentTrack)
                        player.destroy();
                    await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_results'), this.locale)] });
                    break;
                }
                case 'track':
                case 'search': {
                    const track = res.tracks[0];
                    await player.queue.add(track);
                    const queueSize = await player.queue.size();
                    if (!player.playing && !player.paused && queueSize === 0)
                        player.play();
                    await this.interaction.editReply({ embeds: [responseHandler.createTrackEmbed(track, queueSize, this.locale)] });
                    break;
                }
                case 'playlist': {
                    if (!res.playlist)
                        break;
                    for (const track of res.playlist.tracks) {
                        await player.queue.add(track);
                    }
                    const totalSize = await player.queue.totalSize();
                    if (!player.playing && !player.paused && totalSize === res.playlist.tracks.length)
                        player.play();
                    await this.interaction.editReply({ embeds: [responseHandler.createPlaylistEmbed(res.playlist, this.interaction.user, this.locale)] });
                    break;
                }
            }
        };
        this.play = async () => {
            await this.interaction.deferReply();
            if (!(this.interaction instanceof discord_js_1.default.ChatInputCommandInteraction))
                return;
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const query = await this.ytToSpotifyQuery(this.interaction.options.getString('song')) || this.t('responses.default_search');
            if (!query || query === this.t('responses.default_search'))
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.default_search'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection()]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            const guildMember = this.interaction.guild?.members.cache.get(this.interaction.user.id);
            let player = this.client.manager.getPlayer(this.interaction.guildId || '');
            if (player) {
                const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
                if (!playerValid)
                    return await this.interaction.editReply({ embeds: [playerEmbed] });
                if (!this.client.manager.getPlayer(this.interaction.guildId || ''))
                    player = undefined;
            }
            if (!player) {
                player = this.client.manager.create({
                    guildId: this.interaction.guildId || '',
                    voiceChannelId: guildMember?.voice.channelId || '',
                    textChannelId: this.interaction.channelId,
                    ...exports.MUSIC_CONFIG.PLAYER_OPTIONS,
                });
            }
            const guild = this.interaction.guild;
            const botMember = guild.members.me;
            const needsConnection = !botMember?.voice.channelId || botMember.voice.channelId !== guildMember?.voice.channelId;
            if (needsConnection || !['CONNECTING', 'CONNECTED'].includes(player.state)) {
                player.connect();
                await this.interaction.editReply({
                    embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.connected', { channelName: guildMember?.voice.channel?.name || 'Unknown' }))],
                });
            }
            try {
                const res = await this.lavaSearch(query);
                if (res.loadType === 'error')
                    throw new Error('No results found | loadType: error');
                await this.searchResults(res, player);
            }
            catch (error) {
                this.client.logger.error(`[MUSIC] Play error: ${error}`);
                await this.interaction.followUp({
                    embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.play_error'), this.locale, true)],
                    components: [responseHandler.getSupportButton(this.locale)],
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                });
            }
        };
        this.stop = async () => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            try {
                player.destroy();
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.stopped'))] });
            }
            catch (error) {
                this.client.logger.error(`[MUSIC] Stop error: ${error}`);
                await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.stop_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        };
        this.pause = async () => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            const musicValidator = new handlers_1.MusicPlayerValidator(this.client, player);
            const [isValid, errorEmbed] = await musicValidator.validatePauseState(this.interaction);
            if (!isValid && errorEmbed)
                return await this.interaction.editReply({ embeds: [errorEmbed] });
            try {
                player.pause(true);
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.paused'))] });
            }
            catch (error) {
                this.client.logger.error(`[MUSIC] Pause error: ${error}`);
                await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.pause_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        };
        this.resume = async () => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            const musicValidator = new handlers_1.MusicPlayerValidator(this.client, player);
            const [isValid, errorEmbed] = await musicValidator.validateResumeState(this.interaction);
            if (!isValid && errorEmbed)
                return await this.interaction.editReply({ embeds: [errorEmbed] });
            try {
                player.pause(false);
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.resumed'))] });
            }
            catch (error) {
                this.client.logger.error(`[MUSIC] Resume error: ${error}`);
                await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.resume_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        };
        this.skip = async () => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            try {
                if (!player.isAutoplay) {
                    const musicValidator = new handlers_1.MusicPlayerValidator(this.client, player);
                    const [isValid, errorEmbed] = await musicValidator.validateQueueSize(0, this.interaction);
                    if (!isValid && errorEmbed)
                        return await this.interaction.editReply({ embeds: [errorEmbed] });
                    player.stop(1);
                    const queueSize = await player.queue.size();
                    if (queueSize === 0 && this.interaction.guildId)
                        player.destroy();
                }
                else {
                    player.stop();
                }
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.skipped'))] });
            }
            catch (error) {
                this.client.logger.error(`[MUSIC] Skip error: ${error}`);
                await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.skip_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        };
        this.loop = async () => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            try {
                player.setTrackRepeat(!player.trackRepeat);
                const message = player.trackRepeat ? this.t('responses.music.loop_enabled') : this.t('responses.music.loop_disabled');
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(message)] });
            }
            catch (error) {
                this.client.logger.error(`[MUSIC] Loop error: ${error}`);
                await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.loop_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        };
        this.autoplay = async (enable) => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            if (!this.isDeferred && !this.interaction.deferred) {
                await this.interaction.deferReply();
                this.isDeferred = true;
            }
            try {
                player.setAutoplay(enable, this.interaction.user, 5);
                const embed = responseHandler.createSuccessEmbed(enable ? this.t('responses.music.autoplay_enabled') : this.t('responses.music.autoplay_disabled'));
                await this.interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                this.client.logger.error(`[AUTOPLAY] Command error: ${error}`);
                await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.autoplay_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
            }
        };
        this.filter = async (filterName) => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            if (!this.isDeferred && !this.interaction.deferred) {
                await this.interaction.deferReply();
                this.isDeferred = true;
            }
            try {
                if (!this.validateFilterName(filterName)) {
                    const embed = responseHandler.createErrorEmbed(this.t('responses.errors.filter_not_found', { filter: filterName }), this.locale);
                    return await this.interaction.editReply({ embeds: [embed] });
                }
                let success = false;
                if (!player.filters) {
                    player.filters = new magmastream_1.default.Filters(player, this.client.manager);
                }
                switch (filterName) {
                    case 'clear':
                        await player.filters.clearFilters();
                        success = true;
                        break;
                    case 'bassboost':
                        await player.filters.bassBoost(2);
                        success = true;
                        break;
                    case 'nightcore':
                        await player.filters.nightcore(true);
                        success = true;
                        break;
                    case 'vaporwave':
                        await player.filters.vaporwave(true);
                        success = true;
                        break;
                    case 'pop':
                        await player.filters.pop(true);
                        success = true;
                        break;
                    case 'soft':
                        await player.filters.soft(true);
                        success = true;
                        break;
                    case 'treblebass':
                        await player.filters.trebleBass(true);
                        success = true;
                        break;
                    case 'eightd':
                        await player.filters.eightD(true);
                        success = true;
                        break;
                    case 'karaoke':
                        await player.filters.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 });
                        success = true;
                        break;
                    case 'vibrato':
                        await player.filters.setVibrato({ frequency: 4, depth: 0.75 });
                        success = true;
                        break;
                    case 'tremolo':
                        await player.filters.tremolo(true);
                        success = true;
                        break;
                }
                if (!success) {
                    const embed = responseHandler.createErrorEmbed(this.t('responses.errors.filter_not_found', { filter: filterName }), this.locale);
                    return await this.interaction.editReply({ embeds: [embed] });
                }
                const filter = exports.MUSIC_CONFIG.AUDIO_FILTERS[filterName];
                const embed = responseHandler.createSuccessEmbed(this.t('responses.music.filter_applied', { filter: filter.name }));
                await this.interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                this.client.logger.error(`[FILTER] Command error: ${error}`);
                await this.interaction.editReply({
                    embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.filter_error'), this.locale, true)],
                    components: [responseHandler.getSupportButton(this.locale)],
                });
            }
        };
        this.lyrics = async () => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateMusicPlaying(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            if (!this.isDeferred && !this.interaction.deferred) {
                await this.interaction.deferReply();
                this.isDeferred = true;
            }
            try {
                const currentTrack = await player.queue.getCurrent();
                if (!currentTrack) {
                    const embed = responseHandler.createErrorEmbed(this.t('responses.errors.no_current_track'), this.locale);
                    return await this.interaction.editReply({ embeds: [embed] });
                }
                const skipTrackSource = this.interaction instanceof discord_js_1.default.ChatInputCommandInteraction ? this.interaction.options.getBoolean('skip_track_source') || false : false;
                const lyricsData = await player.getCurrentLyrics(skipTrackSource);
                if (!lyricsData || (!lyricsData.text && (!lyricsData.lines || lyricsData.lines.length === 0))) {
                    const embed = responseHandler.createInfoEmbed(this.t('responses.lyrics.not_found', { title: currentTrack.title || 'Unknown Track', artist: currentTrack.author || 'Unknown Artist' }));
                    return await this.interaction.editReply({ embeds: [embed] });
                }
                const trackTitle = format_1.default.truncateText(currentTrack.title || 'Unknown Track', 50);
                const trackArtist = format_1.default.truncateText(currentTrack.author || 'Unknown Artist', 30);
                let lyricsText = '';
                if (lyricsData.text) {
                    lyricsText = lyricsData.text;
                }
                else if (lyricsData.lines && lyricsData.lines.length > 0) {
                    lyricsText = lyricsData.lines
                        .map((line) => line.line)
                        .filter((line) => line && line.trim() !== '')
                        .join('\n');
                }
                if (!lyricsText || lyricsText.trim() === '') {
                    const embed = responseHandler.createInfoEmbed(this.t('responses.lyrics.empty', { title: trackTitle, artist: trackArtist }));
                    return await this.interaction.editReply({ embeds: [embed] });
                }
                const maxLength = 4000;
                const chunks = [];
                if (lyricsText.length <= maxLength) {
                    chunks.push(lyricsText);
                }
                else {
                    const lines = lyricsText.split('\n');
                    let currentChunk = '';
                    for (const line of lines) {
                        if ((currentChunk + line + '\n').length > maxLength) {
                            if (currentChunk) {
                                chunks.push(currentChunk.trim());
                                currentChunk = '';
                            }
                            if (line.length > maxLength) {
                                chunks.push(line.substring(0, maxLength - 3) + '...');
                            }
                            else {
                                currentChunk = line + '\n';
                            }
                        }
                        else {
                            currentChunk += line + '\n';
                        }
                    }
                    if (currentChunk.trim())
                        chunks.push(currentChunk.trim());
                }
                const embeds = [];
                for (let i = 0; i < chunks.length; i++) {
                    const embed = new discord_js_1.default.EmbedBuilder().setColor('#1DB954').setDescription(chunks[i]).setTimestamp();
                    if (i === 0) {
                        embed.setTitle(`🎵 ${this.t('responses.lyrics.title')} - ${trackTitle}`);
                        embed.setAuthor({ name: trackArtist, iconURL: currentTrack.thumbnail || currentTrack.artworkUrl || undefined });
                        if (lyricsData.provider)
                            embed.addFields({ name: this.t('responses.lyrics.provider'), value: lyricsData.provider, inline: true });
                        if (lyricsData.source)
                            embed.addFields({ name: this.t('responses.lyrics.source'), value: lyricsData.source, inline: true });
                        if (currentTrack.thumbnail || currentTrack.artworkUrl)
                            embed.setThumbnail(currentTrack.thumbnail || currentTrack.artworkUrl);
                    }
                    if (chunks.length > 1) {
                        embed.setFooter({ text: `${this.t('responses.lyrics.page')} ${i + 1}/${chunks.length} • ${this.client.user?.username || 'Music Bot'}`, iconURL: this.client.user?.displayAvatarURL() });
                    }
                    else {
                        embed.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
                    }
                    embeds.push(embed);
                }
                if (embeds.length === 1) {
                    await this.interaction.editReply({ embeds: [embeds[0]] });
                }
                else {
                    let currentPage = 0;
                    const row = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('lyrics-previous').setLabel(this.t('responses.lyrics.buttons.previous')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('⬅️').setDisabled(true), new discord_js_1.default.ButtonBuilder()
                        .setCustomId('lyrics-next')
                        .setLabel(this.t('responses.lyrics.buttons.next'))
                        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
                        .setEmoji('➡️')
                        .setDisabled(embeds.length <= 1));
                    const message = await this.interaction.editReply({ embeds: [embeds[currentPage]], components: [row] });
                    const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === this.interaction.user.id, time: 300000 });
                    collector.on('collect', async (i) => {
                        if (i.customId === 'lyrics-previous' && currentPage > 0) {
                            currentPage--;
                        }
                        else if (i.customId === 'lyrics-next' && currentPage < embeds.length - 1) {
                            currentPage++;
                        }
                        const updatedRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder()
                            .setCustomId('lyrics-previous')
                            .setLabel(this.t('responses.lyrics.buttons.previous'))
                            .setStyle(discord_js_1.default.ButtonStyle.Secondary)
                            .setEmoji('⬅️')
                            .setDisabled(currentPage === 0), new discord_js_1.default.ButtonBuilder()
                            .setCustomId('lyrics-next')
                            .setLabel(this.t('responses.lyrics.buttons.next'))
                            .setStyle(discord_js_1.default.ButtonStyle.Secondary)
                            .setEmoji('➡️')
                            .setDisabled(currentPage === embeds.length - 1));
                        await i.update({ embeds: [embeds[currentPage]], components: [updatedRow] });
                    });
                    collector.on('end', async () => {
                        const disabledRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('lyrics-previous').setLabel(this.t('responses.lyrics.buttons.previous')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('⬅️').setDisabled(true), new discord_js_1.default.ButtonBuilder().setCustomId('lyrics-next').setLabel(this.t('responses.lyrics.buttons.next')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('➡️').setDisabled(true));
                        await this.interaction.editReply({ components: [disabledRow] }).catch(() => { });
                    });
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message.includes('lavalyrics-plugin') || error.message.includes('lavasrc-plugin') || error.message.includes('java-lyrics-plugin')) {
                        await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.lyrics_plugin_missing'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
                    }
                    else {
                        await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.lyrics_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
                        this.client.logger.error(`[LYRICS] Command error: ${error}`);
                    }
                }
                else {
                    await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.lyrics_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
                    this.client.logger.error(`[LYRICS] Command error: ${error}`);
                }
            }
        };
        this.queue = async () => {
            await this.interaction.deferReply();
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            const [isValid, embed] = await validator.validateGuildContext();
            if (!isValid)
                return await this.interaction.editReply({ embeds: [embed] });
            try {
                const queue = player.queue;
                const currentTrack = await queue.getCurrent();
                const queueTracks = await queue.getTracks();
                if (!currentTrack && queueTracks.length === 0) {
                    const embed = responseHandler.createInfoEmbed(this.t('responses.queue.empty'));
                    return await this.interaction.editReply({ embeds: [embed] });
                }
                const createQueueEmbed = (page = 0) => {
                    const itemsPerPage = 10;
                    const startIndex = page * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const queuePage = queueTracks.slice(startIndex, endIndex);
                    const embed = new discord_js_1.default.EmbedBuilder()
                        .setColor('#5865f2')
                        .setTitle(`🎵 ${this.t('responses.queue.title')}`)
                        .setTimestamp()
                        .setFooter({ text: queueTracks.length > 0 ? `${this.t('responses.queue.page')} ${page + 1}/${Math.ceil(queueTracks.length / itemsPerPage)} • ${this.client.user?.username || 'Music Bot'}` : `${this.client.user?.username || 'Music Bot'}`, iconURL: this.client.user?.displayAvatarURL() });
                    if (currentTrack) {
                        const currentTitle = format_1.default.truncateText(currentTrack.title, 40);
                        const currentArtist = format_1.default.truncateText(currentTrack.author, 25);
                        const currentDuration = currentTrack.isStream ? this.t('responses.queue.live') : format_1.default.msToTime(currentTrack.duration);
                        const durationMs = currentTrack.isStream ? 0 : Number(currentTrack.duration || 0);
                        const progress = player.playing && durationMs > 0 ? utils_1.ProgressBarUtils.createBarFromPlayer(player, durationMs) : null;
                        const progressBar = progress ? `${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\`` : '';
                        embed.addFields({ name: `🎵 ${this.t('responses.queue.now_playing')}`, value: `**${currentTitle}** - ${currentArtist}\n└ ${currentDuration}`, inline: false });
                        if (progressBar)
                            embed.addFields({ name: `⏱️ ${this.t('responses.queue.progress')}`, value: progressBar, inline: false });
                    }
                    if (queuePage.length > 0) {
                        const queueList = queuePage
                            .map((track, index) => {
                            const position = startIndex + index + 1;
                            const title = format_1.default.truncateText(track.title, 35);
                            const artist = format_1.default.truncateText(track.author, 20);
                            const duration = track.isStream ? this.t('responses.queue.live') : format_1.default.msToTime(track.duration);
                            const requester = track.requester ? ` • ${track.requester.username}` : '';
                            return `**${position}.** **${title}** - ${artist}\n└ ${duration}${requester}`;
                        })
                            .join('\n\n');
                        embed.addFields({ name: `📋 ${this.t('responses.queue.upcoming')} (${queueTracks.length})`, value: queueList.length > 1024 ? queueList.substring(0, 1021) + '...' : queueList, inline: false });
                    }
                    const totalDuration = queueTracks.reduce((acc, track) => acc + (track.isStream ? 0 : track.duration), 0);
                    const totalFormatted = format_1.default.msToTime(totalDuration);
                    const streamCount = queueTracks.filter((track) => track.isStream).length;
                    let description = `**${queueTracks.length}** ${this.t('responses.queue.tracks_in_queue')}`;
                    if (totalDuration > 0)
                        description += `\n**${totalFormatted}** ${this.t('responses.queue.total_duration')}`;
                    if (streamCount > 0)
                        description += `\n**${streamCount}** ${this.t('responses.queue.live_streams')}`;
                    embed.setDescription(description);
                    if (currentTrack && (currentTrack.thumbnail || currentTrack.artworkUrl))
                        embed.setThumbnail(currentTrack.thumbnail || currentTrack.artworkUrl);
                    return embed;
                };
                const createQueueButtons = (page, totalPages, isEmpty = false) => {
                    const navigationRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder()
                        .setCustomId('queue-previous')
                        .setLabel(this.t('responses.queue.buttons.previous'))
                        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                        .setDisabled(page === 0 || isEmpty), new discord_js_1.default.ButtonBuilder()
                        .setCustomId('queue-next')
                        .setLabel(this.t('responses.queue.buttons.next'))
                        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
                        .setEmoji('➡️')
                        .setDisabled(page >= totalPages - 1 || isEmpty), new discord_js_1.default.ButtonBuilder()
                        .setCustomId('queue-shuffle')
                        .setLabel(this.t('responses.queue.buttons.shuffle'))
                        .setStyle(discord_js_1.default.ButtonStyle.Primary)
                        .setEmoji('🔀')
                        .setDisabled(isEmpty || queueTracks.length < 2), new discord_js_1.default.ButtonBuilder()
                        .setCustomId('queue-move')
                        .setLabel(this.t('responses.queue.buttons.move'))
                        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
                        .setEmoji('🔄')
                        .setDisabled(isEmpty || queueTracks.length < 2));
                    const actionRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('queue-remove').setLabel(this.t('responses.queue.buttons.remove')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('➖').setDisabled(isEmpty), new discord_js_1.default.ButtonBuilder().setCustomId('queue-clear').setLabel(this.t('responses.queue.buttons.clear')).setStyle(discord_js_1.default.ButtonStyle.Danger).setEmoji('🗑️').setDisabled(isEmpty));
                    return [navigationRow, actionRow];
                };
                let currentPage = 0;
                const totalPages = Math.ceil(queueTracks.length / 10) || 1;
                const isEmpty = queueTracks.length === 0;
                const embed = createQueueEmbed(currentPage);
                const buttons = createQueueButtons(currentPage, totalPages, isEmpty);
                const message = await this.interaction.editReply({ embeds: [embed], components: isEmpty ? [] : buttons });
                if (!isEmpty) {
                    const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === this.interaction.user.id, time: 300000 });
                    collector.on('collect', async (i) => {
                        try {
                            const updatedQueueTracks = await player.queue.getTracks();
                            const updatedTotalPages = Math.ceil(updatedQueueTracks.length / 10) || 1;
                            if (i.customId === 'queue-previous' && currentPage > 0) {
                                currentPage--;
                                const updatedEmbed = createQueueEmbed(currentPage);
                                const updatedButtons = createQueueButtons(currentPage, updatedTotalPages, false);
                                await i.update({ embeds: [updatedEmbed], components: updatedButtons });
                            }
                            else if (i.customId === 'queue-next' && currentPage < updatedTotalPages - 1) {
                                currentPage++;
                                const updatedEmbed = createQueueEmbed(currentPage);
                                const updatedButtons = createQueueButtons(currentPage, updatedTotalPages, false);
                                await i.update({ embeds: [updatedEmbed], components: updatedButtons });
                            }
                            else if (i.customId === 'queue-shuffle') {
                                await i.deferUpdate();
                                await player.queue.shuffle();
                                await i.followUp({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.queue.shuffled'))], flags: discord_js_1.default.MessageFlags.Ephemeral });
                                const shuffledQueueTracks = await player.queue.getTracks();
                                const shuffledTotalPages = Math.ceil(shuffledQueueTracks.length / 10) || 1;
                                currentPage = Math.min(currentPage, shuffledTotalPages - 1);
                                const shuffledEmbed = createQueueEmbed(currentPage);
                                const shuffledButtons = createQueueButtons(currentPage, shuffledTotalPages, false);
                                await this.interaction.editReply({ embeds: [shuffledEmbed], components: shuffledButtons });
                            }
                            else if (i.customId === 'queue-move') {
                                const moveModal = new discord_js_1.default.ModalBuilder().setCustomId('queue-move-modal').setTitle(this.t('responses.queue.move_modal.title'));
                                const fromInput = new discord_js_1.default.TextInputBuilder().setCustomId('move-from').setLabel(this.t('responses.queue.move_modal.from_label')).setPlaceholder(this.t('responses.queue.move_modal.from_placeholder')).setStyle(discord_js_1.default.TextInputStyle.Short).setMaxLength(10).setRequired(true);
                                const toInput = new discord_js_1.default.TextInputBuilder().setCustomId('move-to').setLabel(this.t('responses.queue.move_modal.to_label')).setPlaceholder(this.t('responses.queue.move_modal.to_placeholder')).setStyle(discord_js_1.default.TextInputStyle.Short).setMaxLength(10).setRequired(true);
                                moveModal.addComponents(new discord_js_1.default.ActionRowBuilder().addComponents(fromInput), new discord_js_1.default.ActionRowBuilder().addComponents(toInput));
                                await i.showModal(moveModal);
                            }
                            else if (i.customId === 'queue-remove') {
                                const removeModal = new discord_js_1.default.ModalBuilder().setCustomId('queue-remove-modal').setTitle(this.t('responses.queue.remove_modal.title'));
                                const positionInput = new discord_js_1.default.TextInputBuilder().setCustomId('queue-position').setLabel(this.t('responses.queue.remove_modal.position_label')).setPlaceholder(this.t('responses.queue.remove_modal.position_placeholder')).setStyle(discord_js_1.default.TextInputStyle.Short).setMaxLength(50).setRequired(true);
                                removeModal.addComponents(new discord_js_1.default.ActionRowBuilder().addComponents(positionInput));
                                await i.showModal(removeModal);
                            }
                            else if (i.customId === 'queue-clear') {
                                await i.deferUpdate();
                                player.queue.clear();
                                await i.followUp({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.queue.cleared'))], flags: discord_js_1.default.MessageFlags.Ephemeral });
                                const emptyEmbed = responseHandler.createInfoEmbed(this.t('responses.queue.empty'));
                                await this.interaction.editReply({ embeds: [emptyEmbed], components: [] });
                            }
                        }
                        catch (error) {
                            this.client.logger.error(`[QUEUE] Button interaction error: ${error}`);
                            if (!i.replied && !i.deferred)
                                await i.reply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.general_error'), this.locale)], flags: discord_js_1.default.MessageFlags.Ephemeral }).catch(() => { });
                        }
                    });
                    collector.on('end', async () => {
                        const disabledNavigationRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('queue-previous').setLabel(this.t('responses.queue.buttons.previous')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('⬅️').setDisabled(true), new discord_js_1.default.ButtonBuilder().setCustomId('queue-next').setLabel(this.t('responses.queue.buttons.next')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('➡️').setDisabled(true), new discord_js_1.default.ButtonBuilder().setCustomId('queue-shuffle').setLabel(this.t('responses.queue.buttons.shuffle')).setStyle(discord_js_1.default.ButtonStyle.Primary).setEmoji('🔀').setDisabled(true), new discord_js_1.default.ButtonBuilder().setCustomId('queue-move').setLabel(this.t('responses.queue.buttons.move')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('🔄').setDisabled(true));
                        const disabledActionRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('queue-remove').setLabel(this.t('responses.queue.buttons.remove')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('➖').setDisabled(true), new discord_js_1.default.ButtonBuilder().setCustomId('queue-clear').setLabel(this.t('responses.queue.buttons.clear')).setStyle(discord_js_1.default.ButtonStyle.Danger).setEmoji('🗑️').setDisabled(true));
                        await this.interaction.editReply({ components: [disabledNavigationRow, disabledActionRow] }).catch(() => { });
                    });
                }
            }
            catch (error) {
                this.client.logger.error(`[QUEUE] Command error: ${error}`);
                await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.general_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
            }
        };
        this.dj = async () => {
            await this.interaction.deferReply();
            if (!(this.interaction instanceof discord_js_1.default.ChatInputCommandInteraction))
                return;
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const djRole = this.interaction.options.getRole('role');
            try {
                let guild = await music_guild_1.default.findOne({ guildId: this.interaction.guildId });
                if (!djRole) {
                    if (!guild || !guild.dj) {
                        const createdRole = await this.interaction.guild?.roles.create({ name: 'DJ', color: discord_js_1.default.Colors.Purple, permissions: [], reason: `DJ role created by ${this.interaction.user.tag}` });
                        if (!createdRole)
                            return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.dj_role_create_failed'), this.locale)] });
                        if (!guild) {
                            guild = new music_guild_1.default({ guildId: this.interaction.guildId, dj: createdRole.id, songs: [] });
                        }
                        else {
                            guild.dj = createdRole.id;
                        }
                        await guild.save();
                        return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_created_and_set', { role: createdRole.name }))] });
                    }
                    else {
                        const currentRole = this.interaction.guild?.roles.cache.get(guild.dj);
                        guild.dj = null;
                        await guild.save();
                        return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_disabled', { role: currentRole?.name || 'Unknown Role' }))] });
                    }
                }
                if (!guild) {
                    guild = new music_guild_1.default({ guildId: this.interaction.guildId, dj: djRole.id, songs: [] });
                    await guild.save();
                    return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_set', { role: djRole.name }))] });
                }
                if (guild.dj === djRole.id) {
                    guild.dj = null;
                    await guild.save();
                    return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_removed', { role: djRole.name }))] });
                }
                else {
                    const previousRoleId = guild.dj;
                    guild.dj = djRole.id;
                    await guild.save();
                    if (previousRoleId) {
                        const previousRole = this.interaction.guild?.roles.cache.get(previousRoleId);
                        return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_changed', { oldRole: previousRole?.name || 'Unknown Role', newRole: djRole.name }))] });
                    }
                    else {
                        return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_set', { role: djRole.name }))] });
                    }
                }
            }
            catch (error) {
                this.client.logger.error(`[DJ] Command error: ${error}`);
                await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.dj_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
            }
        };
        this.client = client;
        this.interaction = interaction;
        this.localeDetector = new locales_1.LocaleDetector();
        this.isDeferred = interaction.deferred;
    }
}
exports.Music = Music;
