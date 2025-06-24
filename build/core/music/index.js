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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Music = exports.MUSIC_CONFIG = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = __importDefault(require("magmastream"));
const format_1 = __importDefault(require("../../utils/format"));
const locales_1 = require("../locales");
const handlers_1 = require("./handlers");
__exportStar(require("./func"), exports);
__exportStar(require("./repo"), exports);
__exportStar(require("./radio"), exports);
__exportStar(require("./handlers"), exports);
__exportStar(require("./auto_search"), exports);
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
        this.validateLavalinkNode = async (nodeChoice) => {
            if (!nodeChoice)
                return null;
            if (this.client.manager.get(this.interaction.guild?.id || ''))
                return new handlers_1.MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.player_exists'), this.locale);
            const node = this.client.manager.nodes.find((n) => n.options.identifier === nodeChoice);
            if (!node)
                return new handlers_1.MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.node_invalid'), this.locale);
            if (!node.connected)
                return new handlers_1.MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.node_not_connected'), this.locale);
            return null;
        };
        this.validateFilterName = (filterName) => {
            return filterName in exports.MUSIC_CONFIG.AUDIO_FILTERS;
        };
        this.lavaSearch = async (query, retry = 5) => {
            let res;
            res = await this.client.manager.search(query, this.interaction.user.id);
            if (res.loadType === 'error' && retry > 0) {
                this.client.logger.warn(`[MUSIC] Error searching songs. Retrying... (${retry} attempts left)`);
                return this.lavaSearch(query, retry - 1);
            }
            return res;
        };
        this.createRadioEmbed = (station, track) => {
            const embed = new discord_js_1.default.EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('📻 ' + this.t('responses.radio.now_playing'))
                .setDescription(`**${station.name}**`)
                .setThumbnail(station.favicon || null)
                .addFields([
                { name: this.t('responses.fields.country'), value: station.country || 'Unknown', inline: true },
                { name: this.t('responses.fields.language'), value: station.language.join(', ') || 'Unknown', inline: true },
                { name: this.t('responses.fields.bitrate'), value: station.bitrate ? `${station.bitrate} kbps` : 'Unknown', inline: true },
                { name: this.t('responses.fields.codec'), value: station.codec || 'Unknown', inline: true },
                { name: this.t('responses.fields.votes'), value: station.votes.toString(), inline: true },
                { name: this.t('responses.fields.stream_type'), value: this.t('responses.radio.live_stream'), inline: true },
            ])
                .setFooter({ text: this.t('responses.radio.footer'), iconURL: this.client.user?.displayAvatarURL() })
                .setTimestamp();
            if (station.tags.length > 0)
                embed.addFields([{ name: this.t('responses.fields.tags'), value: station.tags.slice(0, 5).join(', '), inline: false }]);
            return embed;
        };
        this.handleRadioResult = async (res, player, station) => {
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            switch (res.loadType) {
                case 'empty': {
                    if (!player.queue.current)
                        player.destroy();
                    await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.radio_not_available'), this.locale)] });
                    break;
                }
                case 'track':
                case 'search': {
                    const track = res.tracks[0];
                    player.queue.clear();
                    player.queue.add(track);
                    if (!player.playing && !player.paused)
                        player.play();
                    const radioEmbed = this.createRadioEmbed(station, track);
                    await this.interaction.editReply({ embeds: [radioEmbed] });
                    break;
                }
            }
        };
        this.searchResults = async (res, player) => {
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            switch (res.loadType) {
                case 'empty': {
                    if (!player.queue.current)
                        player.destroy();
                    await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_results'), this.locale)] });
                    break;
                }
                case 'track':
                case 'search': {
                    const track = res.tracks[0];
                    player.queue.add(track);
                    if (!player.playing && !player.paused && !player.queue.size)
                        player.play();
                    await this.interaction.editReply({ embeds: [responseHandler.createTrackEmbed(track, player.queue.size, this.locale)] });
                    break;
                }
                case 'playlist': {
                    if (!res.playlist)
                        break;
                    res.playlist.tracks.forEach((track) => player.queue.add(track));
                    if (!player.playing && !player.paused && player.queue.totalSize === res.playlist.tracks.length)
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
            const query = this.interaction.options.getString('song') || this.t('responses.default_search');
            const nodeChoice = this.interaction.options.getString('lavalink_node') || undefined;
            const nodeCheck = await this.validateLavalinkNode(nodeChoice);
            if (nodeCheck)
                return await this.interaction.editReply({ embeds: [nodeCheck] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection()]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            const guildMember = this.interaction.guild?.members.cache.get(this.interaction.user.id);
            let player = this.client.manager.get(this.interaction.guildId || '');
            if (player) {
                const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
                if (!playerValid)
                    return await this.interaction.editReply({ embeds: [playerEmbed] });
                if (!this.client.manager.get(this.interaction.guildId || ''))
                    player = undefined;
            }
            if (!player) {
                player = this.client.manager.create({
                    guildId: this.interaction.guildId || '',
                    voiceChannelId: guildMember?.voice.channelId || '',
                    textChannelId: this.interaction.channelId,
                    node: nodeChoice,
                    ...exports.MUSIC_CONFIG.PLAYER_OPTIONS,
                });
            }
            const musicValidator = new handlers_1.MusicPlayerValidator(this.client, player);
            const [queueValid, queueError] = await musicValidator.validateMusicSource(query, this.interaction);
            if (!queueValid && queueError)
                return this.interaction.editReply({ embeds: [queueError] });
            const guild = this.interaction.guild;
            const botMember = guild.members.me;
            const needsConnection = !botMember?.voice.channelId || botMember.voice.channelId !== guildMember?.voice.channelId;
            if (needsConnection || !['CONNECTING', 'CONNECTED'].includes(player.state)) {
                player.connect();
                await this.interaction.editReply({
                    embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.connected', { channelName: guildMember?.voice.channel?.name || 'Unknown' }), this.locale)],
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
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
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.stopped'), this.locale)] });
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
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
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.paused'), this.locale)] });
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
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
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.resumed'), this.locale)] });
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
            if (!player)
                return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            const musicValidator = new handlers_1.MusicPlayerValidator(this.client, player);
            const [isValid, errorEmbed] = await musicValidator.validateQueueSize(1, this.interaction);
            if (!isValid && errorEmbed)
                return await this.interaction.editReply({ embeds: [errorEmbed] });
            try {
                player.stop(1);
                if (player.queue.size === 0 && this.interaction.guildId)
                    player.destroy();
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.skipped'), this.locale)] });
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
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
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(message, this.locale)] });
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
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
                const autoplayManager = handlers_1.Autoplay.getInstance(player.guildId, player, this.client);
                if (enable) {
                    autoplayManager.enable(this.interaction.user.id);
                    const embed = responseHandler.createSuccessEmbed(this.t('responses.music.autoplay_enabled'), this.locale);
                    await this.interaction.editReply({ embeds: [embed] });
                }
                else {
                    autoplayManager.disable();
                    const embed = responseHandler.createInfoEmbed(this.t('responses.music.autoplay_disabled'), this.locale);
                    await this.interaction.editReply({ embeds: [embed] });
                }
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
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
                    player.filters = new magmastream_1.default.Filters(player);
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
                const embed = responseHandler.createSuccessEmbed(this.t('responses.music.filter_applied', { filter: filter.name }), this.locale);
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
            const player = this.client.manager.get(this.interaction.guild?.id || '');
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
                if (!player.queue.current) {
                    const embed = responseHandler.createErrorEmbed(this.t('responses.errors.no_current_track'), this.locale);
                    return await this.interaction.editReply({ embeds: [embed] });
                }
                const currentTrack = player.queue.current;
                const skipTrackSource = this.interaction instanceof discord_js_1.default.ChatInputCommandInteraction ? this.interaction.options.getBoolean('skip_track_source') || false : false;
                const lyricsData = await player.getCurrentLyrics(skipTrackSource);
                if (!lyricsData || (!lyricsData.text && (!lyricsData.lines || lyricsData.lines.length === 0))) {
                    const embed = responseHandler.createInfoEmbed(this.t('responses.lyrics.not_found', { title: currentTrack.title || 'Unknown Track', artist: currentTrack.author || 'Unknown Artist' }), this.locale);
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
                    const embed = responseHandler.createInfoEmbed(this.t('responses.lyrics.empty', { title: trackTitle, artist: trackArtist }), this.locale);
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
                if (error instanceof Error && error.message.includes('lavalyrics-plugin')) {
                    await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.lyrics_plugin_missing'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
                }
                else {
                    await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.lyrics_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
                    this.client.logger.error(`[LYRICS] Command error: ${error}`);
                }
            }
        };
        this.playRadio = async (station) => {
            if (!this.isDeferred && !this.interaction.deferred) {
                await this.interaction.deferReply();
                this.isDeferred = true;
            }
            await this.initializeLocale();
            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
            const musicCheck = this.validateMusicEnabled();
            if (musicCheck)
                return await this.interaction.editReply({ embeds: [musicCheck] });
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection()]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            const guildMember = this.interaction.guild?.members.cache.get(this.interaction.user.id);
            let player = this.client.manager.get(this.interaction.guildId || '');
            if (player) {
                const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
                if (!playerValid)
                    return await this.interaction.editReply({ embeds: [playerEmbed] });
                if (!this.client.manager.get(this.interaction.guildId || ''))
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
                await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.connected', { channelName: guildMember?.voice.channel?.name || 'Unknown' }), this.locale)] });
            }
            try {
                const res = await this.lavaSearch(station.urlResolved);
                if (res.loadType === 'error')
                    throw new Error('Radio station not accessible');
                await this.handleRadioResult(res, player, station);
            }
            catch (error) {
                this.client.logger.error(`[RADIO] Play error: ${error}`);
                await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.radio_play_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        };
        this.stopRadio = async () => {
            return this.stop();
        };
        this.client = client;
        this.interaction = interaction;
        this.localeDetector = new locales_1.LocaleDetector();
        this.isDeferred = interaction.deferred;
    }
}
exports.Music = Music;
