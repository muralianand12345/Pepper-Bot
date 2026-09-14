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
exports.Playlist = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const playlist_1 = require("../repo/playlist");
const handlers_1 = require("../handlers");
const v2_1 = require("../../../utils/v2");
const service_1 = require("./service");
const locales_1 = require("../../locales");
const ui_1 = require("./ui");
__exportStar(require("./service"), exports);
__exportStar(require("./ui"), exports);
__exportStar(require("./components"), exports);
/** Runs every `/playlist` subcommand. Replies are ephemeral; only a public share is posted to the channel. */
class Playlist {
    constructor(client, interaction) {
        this.locale = 'en';
        this.t = (key) => key;
        this.execute = async () => {
            await this.interaction.deferReply({ flags: discord_js_1.default.MessageFlags.Ephemeral });
            this.locale = await this.localeDetector.detectLocale(this.interaction);
            this.t = (key, data) => locales_1.LocalizationManager.getInstance().translate(key, this.locale, data);
            const group = this.interaction.options.getSubcommandGroup(false);
            const subcommand = this.interaction.options.getSubcommand(true);
            const handlers = {
                create: this.create,
                delete: this.delete,
                rename: this.rename,
                list: this.list,
                view: this.view,
                share: this.share,
                visibility: this.visibility,
                transfer: this.transfer,
                'song:add': this.addSong,
                'song:current': this.addCurrentSong,
                'song:remove': this.removeSong,
                'song:move': this.moveSong,
            };
            const handler = handlers[group ? `${group}:${subcommand}` : subcommand];
            if (!handler)
                return this.client.logger.warn(`[PLAYLIST] Unknown subcommand: ${group ? `${group} ` : ''}${subcommand}`);
            await handler();
        };
        this.show = async (container) => {
            await this.interaction.editReply((0, v2_1.v2)(container));
        };
        this.failWith = (message, footer) => this.show(this.responseHandler.createErrorContainer(message, this.locale, false, footer));
        this.fail = (key, data, footer) => this.failWith(this.t(key, data), footer);
        this.succeed = (key, data) => this.show(this.responseHandler.createSuccessContainer(this.t(key, data)));
        this.getOwnedPlaylist = async (withAudio = false) => {
            const { playlist, owned } = await service_1.PlaylistService.findForUser(this.userId, this.interaction.options.getString('playlist', true), withAudio);
            if (playlist && owned)
                return playlist;
            await this.fail(playlist ? 'responses.playlist.not_owner' : 'responses.playlist.not_found');
            return null;
        };
        this.readName = () => {
            const name = service_1.PlaylistService.normalizeName(this.interaction.options.getString('name', true));
            return service_1.PlaylistService.isValidName(name) ? name : null;
        };
        this.create = async () => {
            const name = this.readName();
            if (!name)
                return await this.fail('responses.playlist.name_invalid', { max: service_1.PLAYLIST_CONFIG.NAME_MAX_LENGTH });
            const visibility = (this.interaction.options.getString('visibility') ?? 'private');
            const [limits, ownedCount] = await Promise.all([service_1.PlaylistService.getLimits(this.client, this.userId), playlist_1.PlaylistDB.countByOwner(this.userId)]);
            const hint = (0, ui_1.premiumHint)(limits, this.premium, this.t);
            if (ownedCount >= limits.playlists)
                return await this.fail('responses.playlist.limit_playlists', { max: limits.playlists }, hint);
            const result = await playlist_1.PlaylistDB.create(this.userId, name, visibility);
            if (result.status === 'name_taken')
                return await this.fail('responses.playlist.name_taken', { name: (0, ui_1.displayPlaylistName)(name) });
            // Two creates racing on different shards can both pass the count check; undo ours if we overshot.
            if ((await playlist_1.PlaylistDB.countByOwner(this.userId)) > limits.playlists) {
                await playlist_1.PlaylistDB.delete(result.playlist.code, this.userId);
                return await this.fail('responses.playlist.limit_playlists', { max: limits.playlists }, hint);
            }
            await this.succeed('responses.playlist.created', { name: (0, ui_1.displayPlaylistName)(name), visibility: (0, ui_1.visibilityLabel)(visibility, this.t), code: result.playlist.code });
        };
        this.delete = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const container = this.responseHandler.createWarningContainer(this.t('responses.playlist.delete_confirm', { name: (0, ui_1.displayPlaylistName)(playlist.name), count: playlist.tracks.length }));
            const row = (0, ui_1.createPlaylistConfirmRow)((0, ui_1.playlistCustomId)('delete', playlist.code), this.t('responses.playlist.buttons.delete'), (0, ui_1.playlistCustomId)('cancel'), this.t('responses.playlist.buttons.cancel'), discord_js_1.default.ButtonStyle.Danger);
            await this.interaction.editReply((0, v2_1.v2)((0, v2_1.withRows)(container, row)));
        };
        this.rename = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const name = this.readName();
            if (!name)
                return await this.fail('responses.playlist.name_invalid', { max: service_1.PLAYLIST_CONFIG.NAME_MAX_LENGTH });
            const result = await playlist_1.PlaylistDB.rename(playlist.code, this.userId, name);
            if (result === 'name_taken')
                return await this.fail('responses.playlist.name_taken', { name: (0, ui_1.displayPlaylistName)(name) });
            if (result === 'not_found')
                return await this.fail('responses.playlist.not_found');
            await this.succeed('responses.playlist.renamed', { old: (0, ui_1.displayPlaylistName)(playlist.name), name: (0, ui_1.displayPlaylistName)(name) });
        };
        this.list = async () => {
            const [limits, summaries] = await Promise.all([service_1.PlaylistService.getLimits(this.client, this.userId), playlist_1.PlaylistDB.getSummaries({ ownerId: this.userId })]);
            await this.show((0, ui_1.createPlaylistListContainer)(summaries, limits, this.premium, this.t));
        };
        this.view = async () => {
            const { playlist, owned } = await service_1.PlaylistService.findForUser(this.userId, this.interaction.options.getString('playlist', true), false);
            if (!playlist)
                return await this.fail('responses.playlist.not_found');
            if (!owned && playlist.visibility !== 'public')
                return await this.fail('responses.playlist.private');
            const lock = await service_1.PlaylistService.getLock(this.client, playlist);
            await this.interaction.editReply((0, v2_1.v2)((0, v2_1.withRows)((0, ui_1.createPlaylistViewContainer)(playlist, 0, lock, this.t), (0, ui_1.createPlaylistPageRow)(playlist.code, 0, playlist.tracks.length, this.t))));
        };
        this.share = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const container = (0, ui_1.createPlaylistShareContainer)(playlist, this.t);
            if (playlist.visibility !== 'public')
                return await this.show(container);
            // The deferred reply is ephemeral, so confirm there and post the share card as a separate public message.
            await this.succeed('responses.playlist.share_posted', { name: (0, ui_1.displayPlaylistName)(playlist.name) });
            await this.interaction.followUp({ ...(0, v2_1.v2)(container), allowedMentions: { parse: [] } });
        };
        this.visibility = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const visibility = this.interaction.options.getString('state', true);
            if (!(await playlist_1.PlaylistDB.setVisibility(playlist.code, this.userId, visibility)))
                return await this.fail('responses.playlist.not_found');
            await this.succeed('responses.playlist.visibility_set', { name: (0, ui_1.displayPlaylistName)(playlist.name), visibility: (0, ui_1.visibilityLabel)(visibility, this.t) });
        };
        this.transfer = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const target = this.interaction.options.getUser('user', true);
            const name = (0, ui_1.displayPlaylistName)(playlist.name);
            const user = `<@${target.id}>`;
            if (target.id === this.userId)
                return await this.fail('responses.playlist.transfer.self');
            if (target.bot)
                return await this.fail('responses.playlist.transfer.bot');
            const [limits, ownedCount, nameTaken] = await Promise.all([service_1.PlaylistService.getLimits(this.client, target.id), playlist_1.PlaylistDB.countByOwner(target.id), playlist_1.PlaylistDB.nameTaken(target.id, playlist.name)]);
            if (ownedCount >= limits.playlists)
                return await this.fail('responses.playlist.transfer.target_playlist_limit', { user, max: limits.playlists });
            if (playlist.tracks.length > limits.songs)
                return await this.fail('responses.playlist.transfer.target_song_limit', { user, name, count: playlist.tracks.length, max: limits.songs });
            if (nameTaken)
                return await this.fail('responses.playlist.transfer.target_name_taken', { user, name });
            const expiresAt = new Date(Date.now() + service_1.PLAYLIST_CONFIG.TRANSFER_TTL_MS);
            if (!(await playlist_1.PlaylistDB.requestTransfer(playlist.code, this.userId, target.id, expiresAt)))
                return await this.fail('responses.playlist.not_found');
            const targetLocale = (await this.localeDetector.getUserLanguage(target.id)) || this.locale;
            const targetT = (key, data) => locales_1.LocalizationManager.getInstance().translate(key, targetLocale, data);
            const sent = await target
                .send((0, v2_1.v2)((0, v2_1.withRows)((0, ui_1.createTransferRequestContainer)(playlist, this.interaction.user, expiresAt, targetT), (0, ui_1.createTransferRequestRow)(playlist, targetT))))
                .then(() => true)
                .catch(() => false);
            if (!sent) {
                await playlist_1.PlaylistDB.cancelTransfer(playlist.code, this.userId, target.id);
                return await this.fail('responses.playlist.transfer.dm_failed', { user });
            }
            await this.succeed('responses.playlist.transfer.sent', { user, name, expires: Math.floor(expiresAt.getTime() / 1000) });
        };
        this.addSong = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const lock = await service_1.PlaylistService.getLock(this.client, playlist);
            const hint = (0, ui_1.premiumHint)(lock.limits, this.premium, this.t);
            const locked = (0, ui_1.lockMessage)(lock, playlist.tracks.length, this.t);
            if (locked)
                return await this.failWith(locked, hint);
            if (playlist.tracks.length >= lock.limits.songs)
                return await this.fail('responses.playlist.add.full', { name: (0, ui_1.displayPlaylistName)(playlist.name), max: lock.limits.songs }, hint);
            const search = await service_1.PlaylistService.searchTracks(this.client, this.interaction.options.getString('song', true), this.userId);
            if (search.status !== 'ok')
                return await this.fail(search.status === 'collection' ? 'responses.playlist.search.collection' : 'responses.playlist.search.no_results');
            // A picked suggestion already showed the title and artist, so add it straight away; only typed searches get the picker.
            if (search.exact)
                return await this.addEntry(playlist, search.tracks[0]);
            const token = await playlist_1.PlaylistDB.createPending(this.userId, playlist.code, search.tracks, service_1.PLAYLIST_CONFIG.PENDING_TTL_MS);
            await this.interaction.editReply((0, v2_1.v2)((0, v2_1.withRows)((0, ui_1.createPlaylistSearchContainer)(playlist, search.tracks, lock.limits, this.t), (0, ui_1.createPlaylistSearchRow)(token, search.tracks, this.t), (0, ui_1.createPlaylistCancelRow)(token, this.t))));
        };
        this.addCurrentSong = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const player = this.interaction.guildId ? this.client.manager.getPlayer(this.interaction.guildId) : undefined;
            const current = player ? await player.queue.getCurrent() : null;
            if (!current)
                return await this.fail('responses.errors.no_current_track');
            const entry = service_1.PlaylistService.fromTrack(current, this.userId);
            if (!entry)
                return await this.fail('responses.playlist.add.unsupported');
            await this.addEntry(playlist, entry);
        };
        this.addEntry = async (playlist, entry) => {
            const result = await service_1.PlaylistService.addTrack(this.client, this.userId, playlist.code, entry, false);
            const duplicate = result.status === 'duplicate' ? { token: await playlist_1.PlaylistDB.createPending(this.userId, playlist.code, [entry], service_1.PLAYLIST_CONFIG.PENDING_TTL_MS), index: 0 } : undefined;
            await this.show((0, ui_1.createAddResultContainer)(result, entry, { responseHandler: this.responseHandler, premium: this.premium, t: this.t, locale: this.locale, duplicate }));
        };
        this.removeSong = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const name = (0, ui_1.displayPlaylistName)(playlist.name);
            if (playlist.tracks.length === 0)
                return await this.fail('responses.playlist.empty', { name });
            const result = await playlist_1.PlaylistDB.removeTrack(playlist.code, this.userId, this.interaction.options.getInteger('position', true));
            switch (result.status) {
                case 'ok':
                    return await this.succeed('responses.playlist.song.removed', { title: (0, ui_1.displayTrackTitle)(result.track.title), name });
                case 'invalid_position':
                    return await this.fail('responses.playlist.song.invalid_position', { max: playlist.tracks.length });
                case 'conflict':
                    return await this.fail('responses.playlist.song.changed');
                default:
                    return await this.fail('responses.playlist.not_found');
            }
        };
        this.moveSong = async () => {
            const playlist = await this.getOwnedPlaylist();
            if (!playlist)
                return;
            const name = (0, ui_1.displayPlaylistName)(playlist.name);
            if (playlist.tracks.length === 0)
                return await this.fail('responses.playlist.empty', { name });
            const from = this.interaction.options.getInteger('from', true);
            const to = this.interaction.options.getInteger('to', true);
            if (from === to)
                return await this.fail('responses.playlist.song.same_position');
            const result = await playlist_1.PlaylistDB.moveTrack(playlist.code, this.userId, from, to);
            switch (result.status) {
                case 'ok':
                    return await this.succeed('responses.playlist.song.moved', { title: (0, ui_1.displayTrackTitle)(result.track.title), from, to, name });
                case 'invalid_position':
                    return await this.fail('responses.playlist.song.invalid_position', { max: playlist.tracks.length });
                case 'conflict':
                    return await this.fail('responses.playlist.song.changed');
                default:
                    return await this.fail('responses.playlist.not_found');
            }
        };
        this.client = client;
        this.interaction = interaction;
        this.localeDetector = new locales_1.LocaleDetector();
        this.responseHandler = new handlers_1.MusicResponseHandler(client);
    }
    get userId() {
        return this.interaction.user.id;
    }
    get premium() {
        return service_1.PlaylistService.getPremiumLimits(this.client);
    }
}
exports.Playlist = Playlist;
