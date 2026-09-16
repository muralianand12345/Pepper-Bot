import discord from 'discord.js';

import { PlaylistDB } from '../repo/playlist';
import { MusicResponseHandler } from '../handlers';
import { v2, withRows } from '../../../utils/v2';
import { IPlaylistTrack, PlaylistRecord, PlaylistVisibility } from '../../../types';
import { PLAYLIST_CONFIG, PlaylistLimits, PlaylistService } from './service';
import { LocaleDetector, LocalizationManager, TranslatorFunction } from '../../locales';
import { createAddResultContainer, createPlaylistCancelRow, createPlaylistConfirmRow, createPlaylistListContainer, createPlaylistPageRow, createPlaylistSearchContainer, createPlaylistSearchRow, createPlaylistShareContainer, createPlaylistViewContainer, createTransferRequestContainer, createTransferRequestRow, displayPlaylistName, displayTrackTitle, lockMessage, playlistCustomId, premiumHint, visibilityLabel } from './ui';

export * from './service';
export * from './ui';
export * from './components';

type TranslationData = Record<string, string | number>;

export class Playlist {
	private client: discord.Client;
	private interaction: discord.ChatInputCommandInteraction;
	private localeDetector: LocaleDetector;
	private responseHandler: MusicResponseHandler;
	private locale: string = 'en';
	private t: TranslatorFunction = (key) => key;

	constructor(client: discord.Client, interaction: discord.ChatInputCommandInteraction) {
		this.client = client;
		this.interaction = interaction;
		this.localeDetector = new LocaleDetector();
		this.responseHandler = new MusicResponseHandler(client);
	}

	private get userId(): string {
		return this.interaction.user.id;
	}

	private get premium(): PlaylistLimits {
		return PlaylistService.getPremiumLimits(this.client);
	}

	public execute = async (): Promise<void> => {
		await this.interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });
		this.locale = await this.localeDetector.detectLocale(this.interaction);
		this.t = (key, data) => LocalizationManager.getInstance().translate(key, this.locale, data);

		const group = this.interaction.options.getSubcommandGroup(false);
		const subcommand = this.interaction.options.getSubcommand(true);
		const handlers: Record<string, () => Promise<void>> = {
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
		if (!handler) return this.client.logger.warn(`[PLAYLIST] Unknown subcommand: ${group ? `${group} ` : ''}${subcommand}`);
		await handler();
	};

	private show = async (container: discord.ContainerBuilder): Promise<void> => {
		await this.interaction.editReply(v2(container));
	};

	private failWith = (message: string, footer?: string): Promise<void> => this.show(this.responseHandler.createErrorContainer(message, this.locale, false, footer));

	private fail = (key: string, data?: TranslationData, footer?: string): Promise<void> => this.failWith(this.t(key, data), footer);

	private succeed = (key: string, data?: TranslationData): Promise<void> => this.show(this.responseHandler.createSuccessContainer(this.t(key, data)));

	private getOwnedPlaylist = async (withAudio: boolean = false): Promise<PlaylistRecord | null> => {
		const { playlist, owned } = await PlaylistService.findForUser(this.userId, this.interaction.options.getString('playlist', true), withAudio);
		if (playlist && owned) return playlist;
		await this.fail(playlist ? 'responses.playlist.not_owner' : 'responses.playlist.not_found');
		return null;
	};

	private readName = (): string | null => {
		const name = PlaylistService.normalizeName(this.interaction.options.getString('name', true));
		return PlaylistService.isValidName(name) ? name : null;
	};

	private create = async (): Promise<void> => {
		const name = this.readName();
		if (!name) return await this.fail('responses.playlist.name_invalid', { max: PLAYLIST_CONFIG.NAME_MAX_LENGTH });
		const visibility = (this.interaction.options.getString('visibility') ?? 'private') as PlaylistVisibility;

		const [limits, ownedCount] = await Promise.all([PlaylistService.getLimits(this.client, this.userId), PlaylistDB.countByOwner(this.userId)]);
		const hint = premiumHint(limits, this.premium, this.t);
		if (ownedCount >= limits.playlists) return await this.fail('responses.playlist.limit_playlists', { max: limits.playlists }, hint);

		const result = await PlaylistDB.create(this.userId, name, visibility);
		if (result.status === 'name_taken') return await this.fail('responses.playlist.name_taken', { name: displayPlaylistName(name) });

		if ((await PlaylistDB.countByOwner(this.userId)) > limits.playlists) {
			await PlaylistDB.delete(result.playlist.code, this.userId);
			return await this.fail('responses.playlist.limit_playlists', { max: limits.playlists }, hint);
		}

		await this.succeed('responses.playlist.created', { name: displayPlaylistName(name), visibility: visibilityLabel(visibility, this.t), code: result.playlist.code });
	};

	private delete = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;

		const container = this.responseHandler.createWarningContainer(this.t('responses.playlist.delete_confirm', { name: displayPlaylistName(playlist.name), count: playlist.tracks.length }));
		const row = createPlaylistConfirmRow(playlistCustomId('delete', playlist.code), this.t('responses.playlist.buttons.delete'), playlistCustomId('cancel'), this.t('responses.playlist.buttons.cancel'), discord.ButtonStyle.Danger);
		await this.interaction.editReply(v2(withRows(container, row)));
	};

	private rename = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;
		const name = this.readName();
		if (!name) return await this.fail('responses.playlist.name_invalid', { max: PLAYLIST_CONFIG.NAME_MAX_LENGTH });

		const result = await PlaylistDB.rename(playlist.code, this.userId, name);
		if (result === 'name_taken') return await this.fail('responses.playlist.name_taken', { name: displayPlaylistName(name) });
		if (result === 'not_found') return await this.fail('responses.playlist.not_found');
		await this.succeed('responses.playlist.renamed', { old: displayPlaylistName(playlist.name), name: displayPlaylistName(name) });
	};

	private list = async (): Promise<void> => {
		const [limits, summaries] = await Promise.all([PlaylistService.getLimits(this.client, this.userId), PlaylistDB.getSummaries({ ownerId: this.userId })]);
		await this.show(createPlaylistListContainer(summaries, limits, this.premium, this.t));
	};

	private view = async (): Promise<void> => {
		const { playlist, owned } = await PlaylistService.findForUser(this.userId, this.interaction.options.getString('playlist', true), false);
		if (!playlist) return await this.fail('responses.playlist.not_found');
		if (!owned && playlist.visibility !== 'public') return await this.fail('responses.playlist.private');

		const lock = await PlaylistService.getLock(this.client, playlist);
		await this.interaction.editReply(v2(withRows(createPlaylistViewContainer(playlist, 0, lock, this.t), createPlaylistPageRow(playlist.code, 0, playlist.tracks.length, this.t))));
	};

	private share = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;

		const container = createPlaylistShareContainer(playlist, this.t);
		if (playlist.visibility !== 'public') return await this.show(container);

		await this.succeed('responses.playlist.share_posted', { name: displayPlaylistName(playlist.name) });
		await this.interaction.followUp({ ...v2(container), allowedMentions: { parse: [] } });
	};

	private visibility = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;

		const visibility = this.interaction.options.getString('state', true) as PlaylistVisibility;
		if (!(await PlaylistDB.setVisibility(playlist.code, this.userId, visibility))) return await this.fail('responses.playlist.not_found');
		await this.succeed('responses.playlist.visibility_set', { name: displayPlaylistName(playlist.name), visibility: visibilityLabel(visibility, this.t) });
	};

	private transfer = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;

		const target = this.interaction.options.getUser('user', true);
		const name = displayPlaylistName(playlist.name);
		const user = `<@${target.id}>`;
		if (target.id === this.userId) return await this.fail('responses.playlist.transfer.self');
		if (target.bot) return await this.fail('responses.playlist.transfer.bot');

		const [limits, ownedCount, nameTaken] = await Promise.all([PlaylistService.getLimits(this.client, target.id), PlaylistDB.countByOwner(target.id), PlaylistDB.nameTaken(target.id, playlist.name)]);
		if (ownedCount >= limits.playlists) return await this.fail('responses.playlist.transfer.target_playlist_limit', { user, max: limits.playlists });
		if (playlist.tracks.length > limits.songs) return await this.fail('responses.playlist.transfer.target_song_limit', { user, name, count: playlist.tracks.length, max: limits.songs });
		if (nameTaken) return await this.fail('responses.playlist.transfer.target_name_taken', { user, name });

		const expiresAt = new Date(Date.now() + PLAYLIST_CONFIG.TRANSFER_TTL_MS);
		if (!(await PlaylistDB.requestTransfer(playlist.code, this.userId, target.id, expiresAt))) return await this.fail('responses.playlist.not_found');

		const targetLocale = (await this.localeDetector.getUserLanguage(target.id)) || this.locale;
		const targetT: TranslatorFunction = (key, data) => LocalizationManager.getInstance().translate(key, targetLocale, data);
		const sent = await target
			.send(v2(withRows(createTransferRequestContainer(playlist, this.interaction.user, expiresAt, targetT), createTransferRequestRow(playlist, targetT))))
			.then(() => true)
			.catch(() => false);

		if (!sent) {
			await PlaylistDB.cancelTransfer(playlist.code, this.userId, target.id);
			return await this.fail('responses.playlist.transfer.dm_failed', { user });
		}

		await this.succeed('responses.playlist.transfer.sent', { user, name, expires: Math.floor(expiresAt.getTime() / 1000) });
	};

	private addSong = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;

		const lock = await PlaylistService.getLock(this.client, playlist);
		const hint = premiumHint(lock.limits, this.premium, this.t);
		const locked = lockMessage(lock, playlist.tracks.length, this.t);
		if (locked) return await this.failWith(locked, hint);
		if (playlist.tracks.length >= lock.limits.songs) return await this.fail('responses.playlist.add.full', { name: displayPlaylistName(playlist.name), max: lock.limits.songs }, hint);

		const search = await PlaylistService.searchTracks(this.client, this.interaction.options.getString('song', true), this.userId);
		if (search.status !== 'ok') return await this.fail(search.status === 'collection' ? 'responses.playlist.search.collection' : 'responses.playlist.search.no_results');

		if (search.exact) return await this.addEntry(playlist, search.tracks[0]);

		const token = await PlaylistDB.createPending(this.userId, playlist.code, search.tracks, PLAYLIST_CONFIG.PENDING_TTL_MS);
		await this.interaction.editReply(v2(withRows(createPlaylistSearchContainer(playlist, search.tracks, lock.limits, this.t), createPlaylistSearchRow(token, search.tracks, this.t), createPlaylistCancelRow(token, this.t))));
	};

	private addCurrentSong = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;

		const player = this.interaction.guildId ? this.client.manager.getPlayer(this.interaction.guildId) : undefined;
		const current = player ? await player.queue.getCurrent() : null;
		if (!current) return await this.fail('responses.errors.no_current_track');

		const entry = PlaylistService.fromTrack(current, this.userId);
		if (!entry) return await this.fail('responses.playlist.add.unsupported');
		await this.addEntry(playlist, entry);
	};

	private addEntry = async (playlist: PlaylistRecord, entry: IPlaylistTrack): Promise<void> => {
		const result = await PlaylistService.addTrack(this.client, this.userId, playlist.code, entry, false);
		const duplicate = result.status === 'duplicate' ? { token: await PlaylistDB.createPending(this.userId, playlist.code, [entry], PLAYLIST_CONFIG.PENDING_TTL_MS), index: 0 } : undefined;
		await this.show(createAddResultContainer(result, entry, { responseHandler: this.responseHandler, premium: this.premium, t: this.t, locale: this.locale, duplicate }));
	};

	private removeSong = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;
		const name = displayPlaylistName(playlist.name);
		if (playlist.tracks.length === 0) return await this.fail('responses.playlist.empty', { name });

		const result = await PlaylistDB.removeTrack(playlist.code, this.userId, this.interaction.options.getInteger('position', true));
		switch (result.status) {
			case 'ok':
				return await this.succeed('responses.playlist.song.removed', { title: displayTrackTitle(result.track.title), name });
			case 'invalid_position':
				return await this.fail('responses.playlist.song.invalid_position', { max: playlist.tracks.length });
			case 'conflict':
				return await this.fail('responses.playlist.song.changed');
			default:
				return await this.fail('responses.playlist.not_found');
		}
	};

	private moveSong = async (): Promise<void> => {
		const playlist = await this.getOwnedPlaylist();
		if (!playlist) return;
		const name = displayPlaylistName(playlist.name);
		if (playlist.tracks.length === 0) return await this.fail('responses.playlist.empty', { name });

		const from = this.interaction.options.getInteger('from', true);
		const to = this.interaction.options.getInteger('to', true);
		if (from === to) return await this.fail('responses.playlist.song.same_position');

		const result = await PlaylistDB.moveTrack(playlist.code, this.userId, from, to);
		switch (result.status) {
			case 'ok':
				return await this.succeed('responses.playlist.song.moved', { title: displayTrackTitle(result.track.title), from, to, name });
			case 'invalid_position':
				return await this.fail('responses.playlist.song.invalid_position', { max: playlist.tracks.length });
			case 'conflict':
				return await this.fail('responses.playlist.song.changed');
			default:
				return await this.fail('responses.playlist.not_found');
		}
	};
}
