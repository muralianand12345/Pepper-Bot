"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaylistComponentHandler = exports.isPlaylistComponent = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const handlers_1 = require("../handlers");
const playlist_1 = require("../repo/playlist");
const service_1 = require("./service");
const v2_1 = require("../../../utils/v2");
const locales_1 = require("../../locales");
const ui_1 = require("./ui");
const isPlaylistComponent = (interaction) => (interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith(`${ui_1.PLAYLIST_CUSTOM_ID_PREFIX}:`);
exports.isPlaylistComponent = isPlaylistComponent;
/**
 * Handles every `playlist:*` button and select menu. All state lives in the custom ID or MongoDB, because
 * DM interactions (transfer requests) arrive on shard 0 rather than the shard that sent them.
 */
class PlaylistComponentHandler {
    constructor(client, interaction) {
        this.locale = 'en';
        this.t = (key) => key;
        this.handle = async () => {
            this.locale = await this.localeDetector.detectLocale(this.interaction);
            this.t = (key, data) => locales_1.LocalizationManager.getInstance().translate(key, this.locale, data);
            const [, action, ...args] = this.interaction.customId.split(':');
            switch (action) {
                case 'page':
                    return await this.page(args[0], Number(args[1]));
                case 'delete':
                    return await this.delete(args[0]);
                case 'cancel':
                    return await this.cancel(args[0]);
                case 'pick':
                    return await this.pick(args[0]);
                case 'dup':
                    return await this.addPending(args[0], Number(args[1]), true);
                case 'transfer-accept':
                    return await this.acceptTransfer(args[0], args[1]);
                case 'transfer-decline':
                    return await this.declineTransfer(args[0], args[1]);
                default:
                    this.client.logger.warn(`[PLAYLIST] Unknown component interaction: ${this.interaction.customId}`);
            }
        };
        this.update = async (container) => {
            await this.interaction.editReply((0, v2_1.v2)(container));
        };
        this.error = (key, data, footer) => this.responseHandler.createErrorContainer(this.t(key, data), this.locale, false, footer);
        this.page = async (code, page) => {
            await this.interaction.deferUpdate();
            const playlist = await playlist_1.PlaylistDB.findByCode(code, false);
            if (!playlist || !service_1.PlaylistService.canView(playlist, this.interaction.user.id))
                return await this.update(this.error('responses.playlist.not_found'));
            const lock = await service_1.PlaylistService.getLock(this.client, playlist);
            await this.interaction.editReply((0, v2_1.v2)((0, v2_1.withRows)((0, ui_1.createPlaylistViewContainer)(playlist, page, lock, this.t), (0, ui_1.createPlaylistPageRow)(playlist.code, page, playlist.tracks.length, this.t))));
        };
        this.delete = async (code) => {
            await this.interaction.deferUpdate();
            const playlist = await playlist_1.PlaylistDB.findByCode(code, false);
            if (!playlist)
                return await this.update(this.error('responses.playlist.not_found'));
            if (playlist.ownerId !== this.interaction.user.id)
                return await this.update(this.error('responses.playlist.not_owner'));
            const deleted = await playlist_1.PlaylistDB.delete(code, this.interaction.user.id);
            await this.update(deleted ? this.responseHandler.createSuccessContainer(this.t('responses.playlist.deleted', { name: (0, ui_1.displayPlaylistName)(playlist.name) })) : this.error('responses.playlist.not_found'));
        };
        this.cancel = async (token) => {
            await this.interaction.deferUpdate();
            if (token)
                await playlist_1.PlaylistDB.deletePending(token, this.interaction.user.id);
            await this.update(this.responseHandler.createInfoContainer(this.t('responses.playlist.cancelled')));
        };
        this.pick = async (token) => {
            if (!this.interaction.isStringSelectMenu())
                return;
            await this.addPending(token, Number(this.interaction.values[0]), false);
        };
        this.addPending = async (token, index, allowDuplicate) => {
            await this.interaction.deferUpdate();
            const userId = this.interaction.user.id;
            const pending = await playlist_1.PlaylistDB.getPending(token, userId);
            const entry = pending?.tracks[index];
            if (!pending || !entry)
                return await this.update(this.error('responses.playlist.search.expired'));
            const result = await service_1.PlaylistService.addTrack(this.client, userId, pending.code, entry, allowDuplicate);
            if (result.status !== 'duplicate')
                await playlist_1.PlaylistDB.deletePending(token, userId);
            await this.update((0, ui_1.createAddResultContainer)(result, entry, { responseHandler: this.responseHandler, premium: service_1.PlaylistService.getPremiumLimits(this.client), t: this.t, locale: this.locale, duplicate: { token, index } }));
        };
        this.followUpError = async (key, data, footer) => {
            await this.interaction.followUp((0, v2_1.v2Ephemeral)(this.error(key, data, footer)));
        };
        this.notifyOwner = async (ownerId, key, data) => {
            try {
                const owner = await this.client.users.fetch(ownerId);
                const locale = (await this.localeDetector.getUserLanguage(ownerId)) || 'en';
                await owner.send((0, v2_1.v2)(this.responseHandler.createInfoContainer(locales_1.LocalizationManager.getInstance().translate(key, locale, data))));
            }
            catch (error) {
                this.client.logger.debug(`[PLAYLIST] Could not notify playlist owner ${ownerId}: ${error}`);
            }
        };
        this.acceptTransfer = async (code, fromOwnerId) => {
            await this.interaction.deferUpdate();
            const userId = this.interaction.user.id;
            const playlist = await playlist_1.PlaylistDB.findByCode(code, false);
            const isPending = playlist && playlist.ownerId === fromOwnerId && playlist.transfer?.toUserId === userId && new Date(playlist.transfer.expiresAt).getTime() > Date.now();
            if (!playlist || !isPending)
                return await this.update(this.error('responses.playlist.transfer.expired'));
            const name = (0, ui_1.displayPlaylistName)(playlist.name);
            const [limits, ownedCount, nameTaken] = await Promise.all([service_1.PlaylistService.getLimits(this.client, userId), playlist_1.PlaylistDB.countByOwner(userId), playlist_1.PlaylistDB.nameTaken(userId, playlist.name)]);
            const hint = (0, ui_1.premiumHint)(limits, service_1.PlaylistService.getPremiumLimits(this.client), this.t);
            if (ownedCount >= limits.playlists)
                return await this.followUpError('responses.playlist.transfer.accept_playlist_limit', { max: limits.playlists }, hint);
            if (playlist.tracks.length > limits.songs)
                return await this.followUpError('responses.playlist.transfer.accept_song_limit', { name, count: playlist.tracks.length, max: limits.songs }, hint);
            if (nameTaken)
                return await this.followUpError('responses.playlist.transfer.accept_name_taken', { name });
            const result = await playlist_1.PlaylistDB.completeTransfer(code, fromOwnerId, userId);
            if (result.status === 'name_taken')
                return await this.followUpError('responses.playlist.transfer.accept_name_taken', { name });
            if (result.status === 'expired')
                return await this.update(this.error('responses.playlist.transfer.expired'));
            await this.update(this.responseHandler.createSuccessContainer(this.t('responses.playlist.transfer.accepted', { name })));
            await this.notifyOwner(fromOwnerId, 'responses.playlist.transfer.accepted_owner', { user: discord_js_1.default.escapeMarkdown(this.interaction.user.username), name });
        };
        this.declineTransfer = async (code, fromOwnerId) => {
            await this.interaction.deferUpdate();
            const userId = this.interaction.user.id;
            const playlist = await playlist_1.PlaylistDB.findByCode(code, false);
            const cancelled = playlist ? await playlist_1.PlaylistDB.cancelTransfer(code, fromOwnerId, userId) : false;
            if (!playlist || !cancelled)
                return await this.update(this.error('responses.playlist.transfer.expired'));
            const name = (0, ui_1.displayPlaylistName)(playlist.name);
            await this.update(this.responseHandler.createInfoContainer(this.t('responses.playlist.transfer.declined', { name })));
            await this.notifyOwner(fromOwnerId, 'responses.playlist.transfer.declined_owner', { user: discord_js_1.default.escapeMarkdown(this.interaction.user.username), name });
        };
        this.client = client;
        this.interaction = interaction;
        this.localeDetector = new locales_1.LocaleDetector();
        this.responseHandler = new handlers_1.MusicResponseHandler(client);
    }
}
exports.PlaylistComponentHandler = PlaylistComponentHandler;
