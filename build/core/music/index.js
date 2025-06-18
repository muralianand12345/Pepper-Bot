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
exports.Music = exports.MUSIC_CONFIG = exports.LavaLink = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = __importDefault(require("magmastream"));
const locales_1 = require("../locales");
const lavalink_1 = require("./lavalink");
const handlers_1 = require("./handlers");
__exportStar(require("./func"), exports);
__exportStar(require("./repo"), exports);
__exportStar(require("./handlers"), exports);
__exportStar(require("./auto_search"), exports);
__exportStar(require("./now_playing"), exports);
var lavalink_2 = require("./lavalink");
Object.defineProperty(exports, "LavaLink", { enumerable: true, get: function () { return lavalink_2.LavaLink; } });
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
        this.getOptimalNode = async () => {
            if (!this.interaction.guild?.id)
                return null;
            return await this.lavalink.getOptimalNodeForUser(this.interaction.user.id, this.interaction.guild.id);
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
            const userRequestedNode = this.interaction.options.getString('lavalink_node');
            const existingPlayer = this.client.manager.get(this.interaction.guild?.id || '');
            let nodeChoice;
            if (existingPlayer) {
                if (userRequestedNode && userRequestedNode !== existingPlayer.node.options.identifier)
                    return await this.interaction.editReply({ embeds: [new handlers_1.MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.player_exists'), this.locale)] });
                nodeChoice = existingPlayer.node.options.identifier || undefined;
            }
            else {
                nodeChoice = userRequestedNode || (await this.getOptimalNode()) || undefined;
                const nodeCheck = await this.validateLavalinkNode(nodeChoice);
                if (nodeCheck)
                    return await this.interaction.editReply({ embeds: [nodeCheck] });
            }
            const validator = new handlers_1.VoiceChannelValidator(this.client, this.interaction);
            for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection()]) {
                const [isValid, embed] = await check;
                if (!isValid)
                    return await this.interaction.editReply({ embeds: [embed] });
            }
            const guildMember = this.interaction.guild?.members.cache.get(this.interaction.user.id);
            let player;
            if (existingPlayer) {
                player = existingPlayer;
                const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
                if (!playerValid)
                    return await this.interaction.editReply({ embeds: [playerEmbed] });
            }
            else {
                player = this.client.manager.create({
                    guildId: this.interaction.guildId || '',
                    voiceChannelId: guildMember?.voice.channelId || '',
                    textChannelId: this.interaction.channelId,
                    node: nodeChoice || undefined,
                    ...exports.MUSIC_CONFIG.PLAYER_OPTIONS,
                });
                const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
                if (!playerValid)
                    return await this.interaction.editReply({ embeds: [playerEmbed] });
                if (!['CONNECTING', 'CONNECTED'].includes(player.state)) {
                    player.connect();
                    const nodeName = player.node.options.identifier?.startsWith('user_') ? this.t('responses.music.connected_personal', { channelName: guildMember?.voice.channel?.name || 'Unknown' }) : this.t('responses.music.connected', { channelName: guildMember?.voice.channel?.name || 'Unknown' });
                    await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(nodeName, this.locale)] });
                }
            }
            const musicValidator = new handlers_1.MusicPlayerValidator(this.client, player);
            const [queueValid, queueError] = await musicValidator.validateMusicSource(query, this.interaction);
            if (!queueValid && queueError)
                return this.interaction.editReply({ embeds: [queueError] });
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
        this.client = client;
        this.interaction = interaction;
        this.localeDetector = new locales_1.LocaleDetector();
        this.lavalink = new lavalink_1.LavaLink(client);
        this.isDeferred = interaction.deferred;
    }
}
exports.Music = Music;
