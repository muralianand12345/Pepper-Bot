import discord from 'discord.js';

import { MusicResponseHandler } from '../handlers';
import { PlaylistDB } from '../repo/playlist';
import { PlaylistService } from './service';
import { v2, v2Ephemeral, withRows } from '../../../utils/v2';
import { LocaleDetector, LocalizationManager, TranslatorFunction } from '../../locales';
import { createAddResultContainer, createPlaylistPageRow, createPlaylistViewContainer, displayPlaylistName, PLAYLIST_CUSTOM_ID_PREFIX, premiumHint } from './ui';

export type PlaylistComponentInteraction = discord.ButtonInteraction | discord.StringSelectMenuInteraction;

export const isPlaylistComponent = (interaction: discord.Interaction): interaction is PlaylistComponentInteraction => (interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith(`${PLAYLIST_CUSTOM_ID_PREFIX}:`);

export class PlaylistComponentHandler {
	private client: discord.Client;
	private interaction: PlaylistComponentInteraction;
	private localeDetector: LocaleDetector;
	private responseHandler: MusicResponseHandler;
	private locale: string = 'en';
	private t: TranslatorFunction = (key) => key;

	constructor(client: discord.Client, interaction: PlaylistComponentInteraction) {
		this.client = client;
		this.interaction = interaction;
		this.localeDetector = new LocaleDetector();
		this.responseHandler = new MusicResponseHandler(client);
	}

	public handle = async (): Promise<void> => {
		this.locale = await this.localeDetector.detectLocale(this.interaction);
		this.t = (key, data) => LocalizationManager.getInstance().translate(key, this.locale, data);

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

	private update = async (container: discord.ContainerBuilder): Promise<void> => {
		await this.interaction.editReply(v2(container));
	};

	private error = (key: string, data?: Record<string, string | number>, footer?: string): discord.ContainerBuilder => this.responseHandler.createErrorContainer(this.t(key, data), this.locale, false, footer);

	private page = async (code: string, page: number): Promise<void> => {
		await this.interaction.deferUpdate();
		const playlist = await PlaylistDB.findByCode(code, false);
		if (!playlist || !PlaylistService.canView(playlist, this.interaction.user.id)) return await this.update(this.error('responses.playlist.not_found'));

		const lock = await PlaylistService.getLock(this.client, playlist);
		await this.interaction.editReply(v2(withRows(createPlaylistViewContainer(playlist, page, lock, this.t), createPlaylistPageRow(playlist.code, page, playlist.tracks.length, this.t))));
	};

	private delete = async (code: string): Promise<void> => {
		await this.interaction.deferUpdate();
		const playlist = await PlaylistDB.findByCode(code, false);
		if (!playlist) return await this.update(this.error('responses.playlist.not_found'));
		if (playlist.ownerId !== this.interaction.user.id) return await this.update(this.error('responses.playlist.not_owner'));

		const deleted = await PlaylistDB.delete(code, this.interaction.user.id);
		await this.update(deleted ? this.responseHandler.createSuccessContainer(this.t('responses.playlist.deleted', { name: displayPlaylistName(playlist.name) })) : this.error('responses.playlist.not_found'));
	};

	private cancel = async (token?: string): Promise<void> => {
		await this.interaction.deferUpdate();
		if (token) await PlaylistDB.deletePending(token, this.interaction.user.id);
		await this.update(this.responseHandler.createInfoContainer(this.t('responses.playlist.cancelled')));
	};

	private pick = async (token: string): Promise<void> => {
		if (!this.interaction.isStringSelectMenu()) return;
		await this.addPending(token, Number(this.interaction.values[0]), false);
	};

	private addPending = async (token: string, index: number, allowDuplicate: boolean): Promise<void> => {
		await this.interaction.deferUpdate();
		const userId = this.interaction.user.id;
		const pending = await PlaylistDB.getPending(token, userId);
		const entry = pending?.tracks[index];
		if (!pending || !entry) return await this.update(this.error('responses.playlist.search.expired'));

		const result = await PlaylistService.addTrack(this.client, userId, pending.code, entry, allowDuplicate);
		if (result.status !== 'duplicate') await PlaylistDB.deletePending(token, userId);
		await this.update(createAddResultContainer(result, entry, { responseHandler: this.responseHandler, premium: PlaylistService.getPremiumLimits(this.client), t: this.t, locale: this.locale, duplicate: { token, index } }));
	};

	private followUpError = async (key: string, data?: Record<string, string | number>, footer?: string): Promise<void> => {
		await this.interaction.followUp(v2Ephemeral(this.error(key, data, footer)));
	};

	private notifyOwner = async (ownerId: string, key: string, data: Record<string, string>): Promise<void> => {
		try {
			const owner = await this.client.users.fetch(ownerId);
			const locale = (await this.localeDetector.getUserLanguage(ownerId)) || 'en';
			await owner.send(v2(this.responseHandler.createInfoContainer(LocalizationManager.getInstance().translate(key, locale, data))));
		} catch (error) {
			this.client.logger.debug(`[PLAYLIST] Could not notify playlist owner ${ownerId}: ${error}`);
		}
	};

	private acceptTransfer = async (code: string, fromOwnerId: string): Promise<void> => {
		await this.interaction.deferUpdate();
		const userId = this.interaction.user.id;
		const playlist = await PlaylistDB.findByCode(code, false);
		const isPending = playlist && playlist.ownerId === fromOwnerId && playlist.transfer?.toUserId === userId && new Date(playlist.transfer.expiresAt).getTime() > Date.now();
		if (!playlist || !isPending) return await this.update(this.error('responses.playlist.transfer.expired'));

		const name = displayPlaylistName(playlist.name);
		const [limits, ownedCount, nameTaken] = await Promise.all([PlaylistService.getLimits(this.client, userId), PlaylistDB.countByOwner(userId), PlaylistDB.nameTaken(userId, playlist.name)]);
		const hint = premiumHint(limits, PlaylistService.getPremiumLimits(this.client), this.t);
		if (ownedCount >= limits.playlists) return await this.followUpError('responses.playlist.transfer.accept_playlist_limit', { max: limits.playlists }, hint);
		if (playlist.tracks.length > limits.songs) return await this.followUpError('responses.playlist.transfer.accept_song_limit', { name, count: playlist.tracks.length, max: limits.songs }, hint);
		if (nameTaken) return await this.followUpError('responses.playlist.transfer.accept_name_taken', { name });

		const result = await PlaylistDB.completeTransfer(code, fromOwnerId, userId);
		if (result.status === 'name_taken') return await this.followUpError('responses.playlist.transfer.accept_name_taken', { name });
		if (result.status === 'expired') return await this.update(this.error('responses.playlist.transfer.expired'));

		await this.update(this.responseHandler.createSuccessContainer(this.t('responses.playlist.transfer.accepted', { name })));
		await this.notifyOwner(fromOwnerId, 'responses.playlist.transfer.accepted_owner', { user: discord.escapeMarkdown(this.interaction.user.username), name });
	};

	private declineTransfer = async (code: string, fromOwnerId: string): Promise<void> => {
		await this.interaction.deferUpdate();
		const userId = this.interaction.user.id;
		const playlist = await PlaylistDB.findByCode(code, false);
		const cancelled = playlist ? await PlaylistDB.cancelTransfer(code, fromOwnerId, userId) : false;
		if (!playlist || !cancelled) return await this.update(this.error('responses.playlist.transfer.expired'));

		const name = displayPlaylistName(playlist.name);
		await this.update(this.responseHandler.createInfoContainer(this.t('responses.playlist.transfer.declined', { name })));
		await this.notifyOwner(fromOwnerId, 'responses.playlist.transfer.declined_owner', { user: discord.escapeMarkdown(this.interaction.user.username), name });
	};
}
