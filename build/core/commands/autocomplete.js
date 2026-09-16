"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoComplete = void 0;
const locales_1 = require("../locales");
const format_1 = __importDefault(require("../../utils/format"));
const config_1 = require("../../utils/config");
const music_1 = require("../music");
const configManager = config_1.ConfigManager.getInstance();
class AutoComplete {
    constructor(client, interaction) {
        this.hasResponded = false;
        this.safeRespond = async (suggestions) => {
            if (this.hasResponded || !this.interaction.isAutocomplete())
                return false;
            try {
                await this.interaction.respond(suggestions);
                this.hasResponded = true;
                return true;
            }
            catch (error) {
                this.client.logger.warn(`[AUTO_COMPLETE] Failed to respond: ${error}`);
                return false;
            }
        };
        this.withTimeout = (promise, ms, label) => {
            let timer;
            const timeout = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
            });
            return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
        };
        this.getPepperPlaylistChoices = async (userId) => {
            const [summaries, limits] = await Promise.all([music_1.PlaylistDB.getSummaries({ ownerId: userId }), music_1.PlaylistService.getLimitsWithin(this.client, userId)]);
            return summaries.map((summary) => ({ name: (0, music_1.formatPlaylistChoice)(summary.name, summary.trackCount, limits?.songs ?? null, limits ? music_1.PlaylistService.isSummaryLocked(summary, summaries.length, limits) : false, AutoComplete.PEPPER_PLAYLIST_SUFFIX), value: music_1.PlaylistService.toPlayValue(summary.code) }));
        };
        this.getPlaylistCodeChoice = async (value, asPlayValue) => {
            const code = music_1.PlaylistService.normalizeCode(value);
            if (!code)
                return null;
            const [summary] = await music_1.PlaylistDB.getSummaries({ code });
            if (!summary || !music_1.PlaylistService.canView(summary, this.interaction.user.id))
                return null;
            return { name: (0, music_1.formatPlaylistChoice)(summary.name, summary.trackCount, null, false, AutoComplete.PEPPER_PLAYLIST_SUFFIX), value: asPlayValue ? music_1.PlaylistService.toPlayValue(summary.code) : summary.code };
        };
        this.getUserPlaylists = async (defaultText) => {
            const userId = this.interaction.user.id;
            const [pepperChoices, spotifyPlaylists] = await Promise.all([
                this.getPepperPlaylistChoices(userId).catch((error) => {
                    this.client.logger.warn(`[AUTO_COMPLETE] Failed to load Pepper playlists: ${error}`);
                    return [];
                }),
                this.withTimeout(this.manager.getPlaylists(userId, 0, AutoComplete.MAX_CHOICES), AutoComplete.SPOTIFY_TIMEOUT_MS, 'Spotify playlists').catch((error) => {
                    this.client.logger.warn(`[AUTO_COMPLETE] Failed to load Spotify playlists: ${error}`);
                    return null;
                }),
            ]);
            const spotifyChoices = (spotifyPlaylists?.playlists ?? []).map((p) => ({ name: p.name.slice(0, AutoComplete.MAX_CHOICE_NAME_LENGTH), value: p.value }));
            const choices = [...pepperChoices, ...spotifyChoices].slice(0, AutoComplete.MAX_CHOICES);
            if (choices.length) {
                await this.safeRespond(choices);
                return;
            }
            await this.safeRespond([{ name: defaultText.slice(0, AutoComplete.MAX_CHOICE_NAME_LENGTH), value: defaultText }]);
        };
        this.getSpotifySuggestions = async (query, userId) => {
            const userLanguage = (await this.localeDetector.getUserLanguage(userId)) || 'en';
            const spotifyAutoComplete = new music_1.SpotifyAutoComplete(this.client, configManager.getSpotifyClientId(), configManager.getSpotifyClientSecret(), userLanguage);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Spotify API timeout')), AutoComplete.SPOTIFY_TIMEOUT_MS));
            return Promise.race([spotifyAutoComplete.getSuggestions(query), timeoutPromise]);
        };
        this.cleanSearchValue = (value) => {
            return value.split('?')[0].split('#')[0].trim();
        };
        this.respondSongSuggestions = async (value, pinned = null) => {
            const respond = (choices) => this.safeRespond(pinned ? [pinned, ...choices].slice(0, AutoComplete.MAX_CHOICES) : choices);
            const cleanValue = this.cleanSearchValue(value);
            if (!cleanValue) {
                await respond([]);
                return;
            }
            const fallback = cleanValue.length <= AutoComplete.MAX_CHOICE_NAME_LENGTH ? [{ name: cleanValue, value: cleanValue }] : [];
            const shouldSearchSpotify = AutoComplete.SPOTIFY_REGEX.test(cleanValue) || AutoComplete.STRING_WITHOUT_HTTP_REGEX.test(cleanValue);
            if (!shouldSearchSpotify) {
                await respond(fallback);
                return;
            }
            try {
                await respond(await this.getSpotifySuggestions(cleanValue, this.interaction.user.id));
            }
            catch (error) {
                this.client.logger.warn(`[PLAY_AUTOCOMPLETE] Spotify error: ${error}`);
                await respond(fallback);
            }
        };
        this.playAutocomplete = async () => {
            const focused = this.interaction.options.getFocused(true);
            if (focused.name !== 'song')
                return;
            try {
                if (!focused.value?.trim()) {
                    const t = await this.localeDetector.getTranslator(this.interaction);
                    await this.getUserPlaylists(t('responses.default_search'));
                    return;
                }
                const pinned = await this.getPlaylistCodeChoice(focused.value, true).catch(() => null);
                await this.respondSongSuggestions(focused.value, pinned);
            }
            catch (error) {
                this.client.logger.error(`[PLAY_AUTOCOMPLETE] Error: ${error}`);
                await this.safeRespond([]);
            }
        };
        this.respondOwnedPlaylists = async (value) => {
            const userId = this.interaction.user.id;
            const query = value.trim().toLowerCase();
            const [summaries, limits] = await Promise.all([music_1.PlaylistDB.getSummaries({ ownerId: userId }), music_1.PlaylistService.getLimitsWithin(this.client, userId)]);
            const choices = summaries
                .filter((summary) => !query || summary.name.toLowerCase().includes(query) || summary.code.toLowerCase().startsWith(query))
                .map((summary) => ({ name: (0, music_1.formatPlaylistChoice)(summary.name, summary.trackCount, limits?.songs ?? null, limits ? music_1.PlaylistService.isSummaryLocked(summary, summaries.length, limits) : false), value: summary.code }));
            const isView = !this.interaction.options.getSubcommandGroup(false) && this.interaction.options.getSubcommand(false) === 'view';
            if (isView) {
                const shared = await this.getPlaylistCodeChoice(value, false);
                if (shared && !choices.some((choice) => choice.value === shared.value))
                    choices.unshift(shared);
            }
            await this.safeRespond(choices.slice(0, AutoComplete.MAX_CHOICES));
        };
        this.respondPlaylistPositions = async (value) => {
            const input = this.interaction.options.getString('playlist');
            const { playlist, owned } = input ? await music_1.PlaylistService.findForUser(this.interaction.user.id, input, false) : { playlist: null, owned: false };
            if (!playlist || !owned) {
                await this.safeRespond([]);
                return;
            }
            const query = value.trim().toLowerCase();
            const choices = playlist.tracks
                .map((track, index) => ({ name: format_1.default.truncateText(`${index + 1}. ${track.title} - ${track.author}`, 97), value: index + 1 }))
                .filter((choice) => !query || String(choice.value).startsWith(query) || choice.name.toLowerCase().includes(query))
                .slice(0, AutoComplete.MAX_CHOICES);
            await this.safeRespond(choices);
        };
        this.radioAutocomplete = async () => {
            const focused = this.interaction.options.getFocused(true);
            if (focused.name !== 'station')
                return;
            const value = String(focused.value ?? '').trim();
            const countryCode = this.interaction.guild?.preferredLocale?.split('-')[1]?.toUpperCase() ?? null;
            try {
                const service = new music_1.RadioService(this.client);
                const result = await this.withTimeout(service.search(value, { countryCode }), AutoComplete.RADIO_TIMEOUT_MS, 'Radio search').catch((error) => {
                    this.client.logger.warn(`[RADIO_AUTOCOMPLETE] Search failed: ${error}`);
                    return { status: 'ok', stations: (0, music_1.searchCurated)(value, countryCode) };
                });
                const choices = result.stations.slice(0, AutoComplete.MAX_CHOICES).map((station) => ({
                    name: format_1.default.truncateText(`${station.source === 'curated' ? '⭐ ' : ''}${station.name} — ${station.genre}${station.country ? ` (${station.country})` : ''}`, AutoComplete.MAX_CHOICE_NAME_LENGTH - 3),
                    value: station.id,
                }));
                await this.safeRespond(choices);
            }
            catch (error) {
                this.client.logger.error(`[RADIO_AUTOCOMPLETE] Error: ${error}`);
                await this.safeRespond([]);
            }
        };
        this.playlistAutocomplete = async () => {
            const focused = this.interaction.options.getFocused(true);
            const value = String(focused.value ?? '');
            try {
                switch (focused.name) {
                    case 'playlist':
                        await this.respondOwnedPlaylists(value);
                        break;
                    case 'song':
                        await this.respondSongSuggestions(value);
                        break;
                    case 'position':
                    case 'from':
                    case 'to':
                        await this.respondPlaylistPositions(value);
                        break;
                    default:
                        await this.safeRespond([]);
                }
            }
            catch (error) {
                this.client.logger.error(`[PLAYLIST_AUTOCOMPLETE] Error: ${error}`);
                await this.safeRespond([]);
            }
        };
        this.languageAutocomplete = async () => {
            const focused = this.interaction.options.getFocused(true);
            if (focused.name === 'language') {
                const supportedLanguages = this.localeDetector.getSupportedLanguages();
                const query = focused.value.toLowerCase();
                const filtered = supportedLanguages
                    .filter((lang) => lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query))
                    .slice(0, AutoComplete.MAX_CHOICES)
                    .map((lang) => ({ name: `${lang.name} (${lang.code})`.slice(0, AutoComplete.MAX_CHOICE_NAME_LENGTH), value: lang.code }));
                await this.safeRespond(filtered);
            }
        };
        this.helpAutocomplete = async () => {
            const focused = this.interaction.options.getFocused(true);
            if (focused.name === 'command') {
                const commands = Array.from(this.client.commands.values());
                const query = focused.value.toLowerCase();
                const filtered = commands
                    .filter((cmd) => cmd.data.name.toLowerCase().includes(query))
                    .slice(0, AutoComplete.MAX_CHOICES)
                    .map((cmd) => ({ name: `/${cmd.data.name} - ${cmd.data.description}`.slice(0, AutoComplete.MAX_CHOICE_NAME_LENGTH), value: cmd.data.name }));
                await this.safeRespond(filtered);
            }
        };
        this.client = client;
        this.interaction = interaction;
        // Lazy init shared instances
        AutoComplete.manager ??= new music_1.SpotifyManager(client);
        AutoComplete.localeDetector ??= new locales_1.LocaleDetector();
    }
    get manager() {
        return AutoComplete.manager;
    }
    get localeDetector() {
        return AutoComplete.localeDetector;
    }
}
exports.AutoComplete = AutoComplete;
AutoComplete.SPOTIFY_REGEX = /^(https:\/\/open\.spotify\.com\/|spotify:)/i;
AutoComplete.STRING_WITHOUT_HTTP_REGEX = /^(?!https?:\/\/)[\w\s]+$/;
AutoComplete.SPOTIFY_TIMEOUT_MS = 2000;
AutoComplete.RADIO_TIMEOUT_MS = 2000;
AutoComplete.MAX_CHOICE_NAME_LENGTH = 100;
AutoComplete.MAX_CHOICES = 25;
AutoComplete.PEPPER_PLAYLIST_SUFFIX = 'Pepper';
AutoComplete.manager = null;
AutoComplete.localeDetector = null;
