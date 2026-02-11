import axios from 'axios';
import discord from 'discord.js';
import magmastream, { TrackUtils } from 'magmastream';

import { Lyrics } from './lyrics';
import Formatter from '../../utils/format';
import { LocaleDetector } from '../locales';
import { checkUserPremium } from '../commands/premium';
import { ProgressBarUtils, VoiceChannelStatus } from './utils';
import music_guild from '../../events/database/schema/music_guild';
import { MusicResponseHandler, VoiceChannelValidator, MusicPlayerValidator } from './handlers';

export * from './func';
export * from './repo';
export * from './utils';
export * from './search';
export * from './lyrics';
export * from './handlers';
export * from './now_playing';
export * from './activity_check';

export const MUSIC_CONFIG = {
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

export class Music {
	private client: discord.Client;
	private interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction;
	private localeDetector: LocaleDetector;
	private readonly ytRegex: RegExp = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
	private locale: string = 'en';
	private t: (key: string, data?: Record<string, string | number>) => string = (key) => key;
	private isDeferred: boolean = false;

	constructor(client: discord.Client, interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction) {
		this.client = client;
		this.interaction = interaction;
		this.localeDetector = new LocaleDetector();
		this.isDeferred = interaction.deferred;
	}

	private initializeLocale = async (): Promise<void> => {
		this.locale = await this.localeDetector.detectLocale(this.interaction);
		this.t = await this.localeDetector.getTranslator(this.interaction);
	};

	private validateMusicEnabled = (): discord.EmbedBuilder | null => {
		if (this.client.config.music.enabled) return null;
		return new MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.music_disabled'), this.locale);
	};

	private validateFilterName = (filterName: string): filterName is keyof typeof MUSIC_CONFIG.AUDIO_FILTERS => {
		return filterName in MUSIC_CONFIG.AUDIO_FILTERS;
	};

	private lavaSearch = async (query: string, retry: number = 5): Promise<magmastream.SearchResult> => {
		let res: magmastream.SearchResult;
		res = await this.client.manager.search(query, this.interaction.user.id);
		if (TrackUtils.isErrorOrEmptySearchResult(res) && retry > 0) {
			this.client.logger.warn(`[MUSIC] Error searching songs. Retrying... (${retry} attempts left)`);
			return this.lavaSearch(query, retry - 1);
		}
		return res;
	};

	private ytToSpotifyQuery = async (query: string | null): Promise<string | null> => {
		if (query && this.ytRegex.test(query)) {
			const ytSearch = await this.lavaSearch(query, 5);
			if (TrackUtils.isErrorOrEmptySearchResult(ytSearch)) return null;
			if ('tracks' in ytSearch && ytSearch.tracks.length > 0) {
				const firstTrack = ytSearch.tracks[0];
				return `spsearch:${firstTrack.title} ${firstTrack.author}`;
			}
			return null;
		}
		return query;
	};

	private getPlaylistLimit = async (userId: string, playlist: magmastream.PlaylistData): Promise<magmastream.PlaylistData> => {
		const { isPremium, tier } = await checkUserPremium(this.client, userId);
		const userTier = this.client.config.premium.tiers.find((t: { id: number }) => t.id === (isPremium ? tier : 0));
		const limit = userTier?.feature?.playlist_limit || null;
		if (limit === null) return playlist;
		const limitedTracks = playlist.tracks.slice(0, limit);
		return {
			...playlist,
			duration: limitedTracks.reduce((acc, track) => acc + (track.duration || 0), 0),
			tracks: limitedTracks,
		};
	};

	searchResults = async (res: magmastream.SearchResult, player: magmastream.Player): Promise<discord.Message<boolean> | void> => {
		const responseHandler = new MusicResponseHandler(this.client);

		switch (res.loadType) {
			case 'empty': {
				const currentTrack = await player.queue.getCurrent();
				if (!currentTrack) player.destroy();
				await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_results'), this.locale)] });
				break;
			}
			case 'track':
			case 'search': {
				const track = res.tracks[0];
				await player.queue.add(track);
				const queueSize = await player.queue.size();
				if (!player.playing && !player.paused && queueSize === 0) player.play();
				await this.interaction.editReply({ embeds: [responseHandler.createTrackEmbed(track, queueSize, this.locale)] });
				break;
			}
			case 'playlist': {
				if (!res.playlist) break;
				let row: discord.ActionRowBuilder<discord.ButtonBuilder>[] = [];
				const originalLength = res.playlist.tracks.length;
				const limitedPlaylist = await this.getPlaylistLimit(this.interaction.user.id, res.playlist);
				const wasTruncated = limitedPlaylist.tracks.length < originalLength;

				await player.queue.add(limitedPlaylist.tracks);

				const shouldPlay = !player.playing && !player.paused;
				if (shouldPlay) player.play();

				const embed = responseHandler.createPlaylistEmbed(limitedPlaylist, this.interaction.user, this.locale);
				if (wasTruncated) {
					embed.setFooter({ text: this.t('responses.music.playlist_truncated', { added: limitedPlaylist.tracks.length, total: originalLength }) });
					row = [responseHandler.getSupportButton(this.locale)];
				}
				await this.interaction.editReply({ embeds: [embed], components: row });
				break;
			}
		}
	};

	play = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		if (!(this.interaction instanceof discord.ChatInputCommandInteraction)) return;

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const query = (await this.ytToSpotifyQuery(this.interaction.options.getString('song'))) || this.t('responses.default_search');
		if (!query || query === this.t('responses.default_search')) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.default_search'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection()]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		const guildMember = this.interaction.guild?.members.cache.get(this.interaction.user.id);
		let player = this.client.manager.getPlayer(this.interaction.guildId || '');

		if (player) {
			const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
			if (!playerValid) return await this.interaction.editReply({ embeds: [playerEmbed] });
			if (!this.client.manager.getPlayer(this.interaction.guildId || '')) player = undefined;
		}

		if (!player) {
			player = this.client.manager.create({
				guildId: this.interaction.guildId || '',
				voiceChannelId: guildMember?.voice.channelId || '',
				textChannelId: this.interaction.channelId,
				...MUSIC_CONFIG.PLAYER_OPTIONS,
			});
		}

		const guild = this.interaction.guild!;
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
			if (res.loadType === 'error') throw new Error('No results found | loadType: error');
			await this.searchResults(res, player);
		} catch (error) {
			this.client.logger.error(`[MUSIC] Play error: ${error}`);
			await this.interaction.followUp({
				embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.play_error'), this.locale, true)],
				components: [responseHandler.getSupportButton(this.locale)],
				flags: discord.MessageFlags.Ephemeral,
			});
		}
	};

	stop = async (): Promise<discord.Message | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		try {
			player.destroy();
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.stopped'))] });
		} catch (error) {
			this.client.logger.error(`[MUSIC] Stop error: ${error}`);
			await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.stop_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord.MessageFlags.Ephemeral });
		}
	};

	pause = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		const musicValidator = new MusicPlayerValidator(this.client, player);
		const [isValid, errorEmbed] = await musicValidator.validatePauseState(this.interaction);
		if (!isValid && errorEmbed) return await this.interaction.editReply({ embeds: [errorEmbed] });

		const voiceStatus = new VoiceChannelStatus(this.client);

		try {
			player.pause(true);
			const currentTrack = await player.queue.getCurrent();
			if (currentTrack) await voiceStatus.setPaused(player, currentTrack);
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.paused'))] });
		} catch (error) {
			this.client.logger.error(`[MUSIC] Pause error: ${error}`);
			await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.pause_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord.MessageFlags.Ephemeral });
		}
	};

	resume = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		const musicValidator = new MusicPlayerValidator(this.client, player);
		const [isValid, errorEmbed] = await musicValidator.validateResumeState(this.interaction);
		if (!isValid && errorEmbed) return await this.interaction.editReply({ embeds: [errorEmbed] });

		const voiceStatus = new VoiceChannelStatus(this.client);

		try {
			player.pause(false);
			const currentTrack = await player.queue.getCurrent();
			if (currentTrack) await voiceStatus.setPlaying(player, currentTrack);
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.resumed'))] });
		} catch (error) {
			this.client.logger.error(`[MUSIC] Resume error: ${error}`);
			await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.resume_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord.MessageFlags.Ephemeral });
		}
	};

	skip = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		try {
			if (!player.isAutoplay) {
				const musicValidator = new MusicPlayerValidator(this.client, player);
				const [isValid, errorEmbed] = await musicValidator.validateQueueSize(0, this.interaction);
				if (!isValid && errorEmbed) return await this.interaction.editReply({ embeds: [errorEmbed] });

				player.stop(1);
				const queueSize = await player.queue.size();
				if (queueSize === 0 && this.interaction.guildId) player.destroy();
			} else {
				player.stop();
			}
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.skipped'))] });
		} catch (error) {
			this.client.logger.error(`[MUSIC] Skip error: ${error}`);
			await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.skip_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord.MessageFlags.Ephemeral });
		}
	};

	loop = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		try {
			player.setTrackRepeat(!player.trackRepeat);
			const message = player.trackRepeat ? this.t('responses.music.loop_enabled') : this.t('responses.music.loop_disabled');

			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(message)] });
		} catch (error) {
			this.client.logger.error(`[MUSIC] Loop error: ${error}`);
			await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.loop_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord.MessageFlags.Ephemeral });
		}
	};

	autoplay = async (enable: boolean): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		if (!this.isDeferred && !this.interaction.deferred) {
			await this.interaction.deferReply();
			this.isDeferred = true;
		}

		try {
			player.setAutoplay(enable, this.interaction.user, 5);
			const embed = responseHandler.createSuccessEmbed(enable ? this.t('responses.music.autoplay_enabled') : this.t('responses.music.autoplay_disabled'));
			await this.interaction.editReply({ embeds: [embed] });
		} catch (error) {
			this.client.logger.error(`[AUTOPLAY] Command error: ${error}`);
			await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.autoplay_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
		}
	};

	filter = async (filterName: string): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
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
				player.filters = new magmastream.Filters(player, this.client.manager);
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

			const filter = MUSIC_CONFIG.AUDIO_FILTERS[filterName];
			const embed = responseHandler.createSuccessEmbed(this.t('responses.music.filter_applied', { filter: filter.name }));
			await this.interaction.editReply({ embeds: [embed] });
		} catch (error) {
			this.client.logger.error(`[FILTER] Command error: ${error}`);
			await this.interaction.editReply({
				embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.filter_error'), this.locale, true)],
				components: [responseHandler.getSupportButton(this.locale)],
			});
		}
	};

	lyrics = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateMusicPlaying(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		try {
			const currentTrack = await player.queue.getCurrent();
			if (!currentTrack) {
				const embed = responseHandler.createErrorEmbed(this.t('responses.errors.no_current_track'), this.locale);
				return await this.interaction.editReply({ embeds: [embed] });
			}

			const spotifyUrlRegex = /https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/;
			const spotifyUrl = currentTrack.uri && spotifyUrlRegex.test(currentTrack.uri) ? currentTrack.uri : null;

			if (!spotifyUrl) {
				const embed = responseHandler.createInfoEmbed(this.t('responses.lyrics.not_spotify', { title: currentTrack.title || 'Unknown Track', artist: currentTrack.author || 'Unknown Artist' }));
				return await this.interaction.editReply({ embeds: [embed] });
			}

			const trackTitle = Formatter.truncateText(currentTrack.title || 'Unknown Track', 50);
			const trackArtist = Formatter.truncateText(currentTrack.author || 'Unknown Artist', 30);

			await this.interaction.editReply({ embeds: [responseHandler.createInfoEmbed(this.t('responses.lyrics.fetching'))] });

			const lyricsProvider = new Lyrics();
			const lyricsText = await lyricsProvider.getPlainText(spotifyUrl);

			if (!lyricsText || lyricsText.trim() === '') {
				const embed = responseHandler.createInfoEmbed(this.t('responses.lyrics.not_found', { title: trackTitle, artist: trackArtist }));
				return await this.interaction.editReply({ embeds: [embed] });
			}

			const maxLength = 4000;
			const chunks: string[] = [];

			if (lyricsText.length <= maxLength) {
				chunks.push(lyricsText);
			} else {
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
						} else {
							currentChunk = line + '\n';
						}
					} else {
						currentChunk += line + '\n';
					}
				}

				if (currentChunk.trim()) chunks.push(currentChunk.trim());
			}

			const embeds: discord.EmbedBuilder[] = [];

			for (let i = 0; i < chunks.length; i++) {
				const embed = new discord.EmbedBuilder().setColor('#1DB954').setDescription(chunks[i]).setTimestamp();

				if (i === 0) {
					embed.setTitle(`🎵 ${this.t('responses.lyrics.title')} - ${trackTitle}`);
					embed.setAuthor({ name: trackArtist, iconURL: currentTrack.thumbnail || currentTrack.artworkUrl || undefined });
					if (currentTrack.thumbnail || currentTrack.artworkUrl) embed.setThumbnail(currentTrack.thumbnail || currentTrack.artworkUrl);
				}

				if (chunks.length > 1) {
					embed.setFooter({ text: `${this.t('responses.lyrics.page')} ${i + 1}/${chunks.length} • ${this.client.user?.username || 'Music Bot'}`, iconURL: this.client.user?.displayAvatarURL() });
				} else {
					embed.setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
				}
				embeds.push(embed);
			}

			if (embeds.length === 1) {
				await this.interaction.editReply({ embeds: [embeds[0]] });
			} else {
				let currentPage = 0;
				const row = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
					new discord.ButtonBuilder().setCustomId('lyrics-previous').setLabel(this.t('responses.lyrics.buttons.previous')).setStyle(discord.ButtonStyle.Secondary).setEmoji('⬅️').setDisabled(true),
					new discord.ButtonBuilder()
						.setCustomId('lyrics-next')
						.setLabel(this.t('responses.lyrics.buttons.next'))
						.setStyle(discord.ButtonStyle.Secondary)
						.setEmoji('➡️')
						.setDisabled(embeds.length <= 1),
				);

				const message = await this.interaction.editReply({ embeds: [embeds[currentPage]], components: [row] });
				const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === this.interaction.user.id, time: 300000 });
				collector.on('collect', async (i) => {
					if (i.customId === 'lyrics-previous' && currentPage > 0) {
						currentPage--;
					} else if (i.customId === 'lyrics-next' && currentPage < embeds.length - 1) {
						currentPage++;
					}

					const updatedRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
						new discord.ButtonBuilder()
							.setCustomId('lyrics-previous')
							.setLabel(this.t('responses.lyrics.buttons.previous'))
							.setStyle(discord.ButtonStyle.Secondary)
							.setEmoji('⬅️')
							.setDisabled(currentPage === 0),
						new discord.ButtonBuilder()
							.setCustomId('lyrics-next')
							.setLabel(this.t('responses.lyrics.buttons.next'))
							.setStyle(discord.ButtonStyle.Secondary)
							.setEmoji('➡️')
							.setDisabled(currentPage === embeds.length - 1),
					);

					await i.update({ embeds: [embeds[currentPage]], components: [updatedRow] });
				});

				collector.on('end', async () => {
					const disabledRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('lyrics-previous').setLabel(this.t('responses.lyrics.buttons.previous')).setStyle(discord.ButtonStyle.Secondary).setEmoji('⬅️').setDisabled(true), new discord.ButtonBuilder().setCustomId('lyrics-next').setLabel(this.t('responses.lyrics.buttons.next')).setStyle(discord.ButtonStyle.Secondary).setEmoji('➡️').setDisabled(true));
					await this.interaction.editReply({ components: [disabledRow] }).catch(() => {});
				});
			}
		} catch (error) {
			await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.lyrics_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
			this.client.logger.error(`[LYRICS] Command error: ${error}`);
		}
	};

	queue = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		const [isValid, embed] = await validator.validateGuildContext();
		if (!isValid) return await this.interaction.editReply({ embeds: [embed] });

		try {
			const queue = player.queue;
			const currentTrack = await queue.getCurrent();
			const queueTracks = await queue.getTracks();

			if (!currentTrack && queueTracks.length === 0) {
				const embed = responseHandler.createInfoEmbed(this.t('responses.queue.empty'));
				return await this.interaction.editReply({ embeds: [embed] });
			}

			const createQueueEmbed = (page: number = 0): discord.EmbedBuilder => {
				const itemsPerPage = 10;
				const startIndex = page * itemsPerPage;
				const endIndex = startIndex + itemsPerPage;
				const queuePage = queueTracks.slice(startIndex, endIndex);

				const embed = new discord.EmbedBuilder()
					.setColor('#5865f2')
					.setTitle(`🎵 ${this.t('responses.queue.title')}`)
					.setTimestamp()
					.setFooter({ text: queueTracks.length > 0 ? `${this.t('responses.queue.page')} ${page + 1}/${Math.ceil(queueTracks.length / itemsPerPage)} • ${this.client.user?.username || 'Music Bot'}` : `${this.client.user?.username || 'Music Bot'}`, iconURL: this.client.user?.displayAvatarURL() });

				if (currentTrack) {
					const currentTitle = Formatter.truncateText(currentTrack.title, 40);
					const currentArtist = Formatter.truncateText(currentTrack.author, 25);
					const currentDuration = currentTrack.isStream ? this.t('responses.queue.live') : Formatter.msToTime(currentTrack.duration);
					const durationMs = currentTrack.isStream ? 0 : Number(currentTrack.duration || 0);
					const progress = player.playing && durationMs > 0 ? ProgressBarUtils.createBarFromPlayer(player, durationMs) : null;
					const progressBar = progress ? `${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\`` : '';

					embed.addFields({ name: `🎵 ${this.t('responses.queue.now_playing')}`, value: `**${currentTitle}** - ${currentArtist}\n└ ${currentDuration}`, inline: false });
					if (progressBar) embed.addFields({ name: `⏱️ ${this.t('responses.queue.progress')}`, value: progressBar, inline: false });
				}

				if (queuePage.length > 0) {
					const queueList = queuePage
						.map((track: magmastream.Track, index: number) => {
							const position = startIndex + index + 1;
							const title = Formatter.truncateText(track.title, 35);
							const artist = Formatter.truncateText(track.author, 20);
							const duration = track.isStream ? this.t('responses.queue.live') : Formatter.msToTime(track.duration);
							const requester = track.requester ? ` • ${track.requester.username}` : '';
							return `**${position}.** **${title}** - ${artist}\n└ ${duration}${requester}`;
						})
						.join('\n\n');

					embed.addFields({ name: `📋 ${this.t('responses.queue.upcoming')} (${queueTracks.length})`, value: queueList.length > 1024 ? queueList.substring(0, 1021) + '...' : queueList, inline: false });
				}

				const totalDuration = queueTracks.reduce((acc: number, track: magmastream.Track) => acc + (track.isStream ? 0 : track.duration), 0) as number;
				const totalFormatted = Formatter.msToTime(totalDuration);
				const streamCount = queueTracks.filter((track) => track.isStream).length;

				let description = `**${queueTracks.length}** ${this.t('responses.queue.tracks_in_queue')}`;
				if (totalDuration > 0) description += `\n**${totalFormatted}** ${this.t('responses.queue.total_duration')}`;
				if (streamCount > 0) description += `\n**${streamCount}** ${this.t('responses.queue.live_streams')}`;

				embed.setDescription(description);
				if (currentTrack && (currentTrack.thumbnail || currentTrack.artworkUrl)) embed.setThumbnail(currentTrack.thumbnail || currentTrack.artworkUrl);
				return embed;
			};

			const createQueueButtons = (page: number, totalPages: number, isEmpty: boolean = false): discord.ActionRowBuilder<discord.ButtonBuilder>[] => {
				const navigationRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
					new discord.ButtonBuilder()
						.setCustomId('queue-previous')
						.setLabel(this.t('responses.queue.buttons.previous'))
						.setStyle(discord.ButtonStyle.Secondary)
						.setEmoji('⬅️')
						.setDisabled(page === 0 || isEmpty),
					new discord.ButtonBuilder()
						.setCustomId('queue-next')
						.setLabel(this.t('responses.queue.buttons.next'))
						.setStyle(discord.ButtonStyle.Secondary)
						.setEmoji('➡️')
						.setDisabled(page >= totalPages - 1 || isEmpty),
					new discord.ButtonBuilder()
						.setCustomId('queue-shuffle')
						.setLabel(this.t('responses.queue.buttons.shuffle'))
						.setStyle(discord.ButtonStyle.Primary)
						.setEmoji('🔀')
						.setDisabled(isEmpty || queueTracks.length < 2),
					new discord.ButtonBuilder()
						.setCustomId('queue-move')
						.setLabel(this.t('responses.queue.buttons.move'))
						.setStyle(discord.ButtonStyle.Secondary)
						.setEmoji('🔄')
						.setDisabled(isEmpty || queueTracks.length < 2),
				);
				const actionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('queue-remove').setLabel(this.t('responses.queue.buttons.remove')).setStyle(discord.ButtonStyle.Secondary).setEmoji('➖').setDisabled(isEmpty), new discord.ButtonBuilder().setCustomId('queue-clear').setLabel(this.t('responses.queue.buttons.clear')).setStyle(discord.ButtonStyle.Danger).setEmoji('🗑️').setDisabled(isEmpty));
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
						} else if (i.customId === 'queue-next' && currentPage < updatedTotalPages - 1) {
							currentPage++;
							const updatedEmbed = createQueueEmbed(currentPage);
							const updatedButtons = createQueueButtons(currentPage, updatedTotalPages, false);
							await i.update({ embeds: [updatedEmbed], components: updatedButtons });
						} else if (i.customId === 'queue-shuffle') {
							await i.deferUpdate();
							await player.queue.shuffle();
							await i.followUp({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.queue.shuffled'))], flags: discord.MessageFlags.Ephemeral });

							const shuffledQueueTracks = await player.queue.getTracks();
							const shuffledTotalPages = Math.ceil(shuffledQueueTracks.length / 10) || 1;
							currentPage = Math.min(currentPage, shuffledTotalPages - 1);

							const shuffledEmbed = createQueueEmbed(currentPage);
							const shuffledButtons = createQueueButtons(currentPage, shuffledTotalPages, false);
							await this.interaction.editReply({ embeds: [shuffledEmbed], components: shuffledButtons });
						} else if (i.customId === 'queue-move') {
							const moveModal = new discord.ModalBuilder().setCustomId('queue-move-modal').setTitle(this.t('responses.queue.move_modal.title'));
							const fromInput = new discord.TextInputBuilder().setCustomId('move-from').setLabel(this.t('responses.queue.move_modal.from_label')).setPlaceholder(this.t('responses.queue.move_modal.from_placeholder')).setStyle(discord.TextInputStyle.Short).setMaxLength(10).setRequired(true);
							const toInput = new discord.TextInputBuilder().setCustomId('move-to').setLabel(this.t('responses.queue.move_modal.to_label')).setPlaceholder(this.t('responses.queue.move_modal.to_placeholder')).setStyle(discord.TextInputStyle.Short).setMaxLength(10).setRequired(true);
							moveModal.addComponents(new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(fromInput), new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(toInput));

							await i.showModal(moveModal);
						} else if (i.customId === 'queue-remove') {
							const removeModal = new discord.ModalBuilder().setCustomId('queue-remove-modal').setTitle(this.t('responses.queue.remove_modal.title'));
							const positionInput = new discord.TextInputBuilder().setCustomId('queue-position').setLabel(this.t('responses.queue.remove_modal.position_label')).setPlaceholder(this.t('responses.queue.remove_modal.position_placeholder')).setStyle(discord.TextInputStyle.Short).setMaxLength(50).setRequired(true);
							removeModal.addComponents(new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(positionInput));

							await i.showModal(removeModal);
						} else if (i.customId === 'queue-clear') {
							await i.deferUpdate();
							player.queue.clear();
							await i.followUp({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.queue.cleared'))], flags: discord.MessageFlags.Ephemeral });

							const emptyEmbed = responseHandler.createInfoEmbed(this.t('responses.queue.empty'));
							await this.interaction.editReply({ embeds: [emptyEmbed], components: [] });
						}
					} catch (error) {
						this.client.logger.error(`[QUEUE] Button interaction error: ${error}`);
						if (!i.replied && !i.deferred) await i.reply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.general_error'), this.locale)], flags: discord.MessageFlags.Ephemeral }).catch(() => {});
					}
				});

				collector.on('end', async () => {
					const disabledNavigationRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('queue-previous').setLabel(this.t('responses.queue.buttons.previous')).setStyle(discord.ButtonStyle.Secondary).setEmoji('⬅️').setDisabled(true), new discord.ButtonBuilder().setCustomId('queue-next').setLabel(this.t('responses.queue.buttons.next')).setStyle(discord.ButtonStyle.Secondary).setEmoji('➡️').setDisabled(true), new discord.ButtonBuilder().setCustomId('queue-shuffle').setLabel(this.t('responses.queue.buttons.shuffle')).setStyle(discord.ButtonStyle.Primary).setEmoji('🔀').setDisabled(true), new discord.ButtonBuilder().setCustomId('queue-move').setLabel(this.t('responses.queue.buttons.move')).setStyle(discord.ButtonStyle.Secondary).setEmoji('🔄').setDisabled(true));

					const disabledActionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('queue-remove').setLabel(this.t('responses.queue.buttons.remove')).setStyle(discord.ButtonStyle.Secondary).setEmoji('➖').setDisabled(true), new discord.ButtonBuilder().setCustomId('queue-clear').setLabel(this.t('responses.queue.buttons.clear')).setStyle(discord.ButtonStyle.Danger).setEmoji('🗑️').setDisabled(true));
					await this.interaction.editReply({ components: [disabledNavigationRow, disabledActionRow] }).catch(() => {});
				});
			}
		} catch (error) {
			this.client.logger.error(`[QUEUE] Command error: ${error}`);
			await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.general_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
		}
	};

	dj = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		if (!(this.interaction instanceof discord.ChatInputCommandInteraction)) return;

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const djRole = this.interaction.options.getRole('role');
		try {
			let guild = await music_guild.findOne({ guildId: this.interaction.guildId });

			if (!djRole) {
				if (!guild || !guild.dj) {
					const createdRole = await this.interaction.guild?.roles.create({ name: 'DJ', color: discord.Colors.Purple, permissions: [], reason: `DJ role created by ${this.interaction.user.tag}` });
					if (!createdRole) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.dj_role_create_failed'), this.locale)] });

					if (!guild) {
						guild = new music_guild({ guildId: this.interaction.guildId!, dj: createdRole.id, songs: [] });
					} else {
						guild.dj = createdRole.id;
					}
					await guild.save();
					return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_created_and_set', { role: createdRole.name }))] });
				} else {
					const currentRole = this.interaction.guild?.roles.cache.get(guild.dj);
					guild.dj = null;
					await guild.save();
					return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_disabled', { role: currentRole?.name || 'Unknown Role' }))] });
				}
			}

			if (!guild) {
				guild = new music_guild({ guildId: this.interaction.guildId!, dj: djRole.id, songs: [] });
				await guild.save();
				return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_set', { role: djRole.name }))] });
			}

			if (guild.dj === djRole.id) {
				guild.dj = null;
				await guild.save();
				return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_removed', { role: djRole.name }))] });
			} else {
				const previousRoleId = guild.dj;
				guild.dj = djRole.id;
				await guild.save();

				if (previousRoleId) {
					const previousRole = this.interaction.guild?.roles.cache.get(previousRoleId);
					return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_changed', { oldRole: previousRole?.name || 'Unknown Role', newRole: djRole.name }))] });
				} else {
					return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.dj.role_set', { role: djRole.name }))] });
				}
			}
		} catch (error) {
			this.client.logger.error(`[DJ] Command error: ${error}`);
			await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.dj_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
		}
	};

	volume = async (volume: number): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.getPlayer(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		try {
			player.setVolume(volume);

			const message = this.t('responses.music.volume_set', { volume: volume });
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(message)] });
		} catch (error) {
			this.client.logger.error(`[MUSIC] Volume error: ${error}`);
			await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.volume_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord.MessageFlags.Ephemeral });
		}
	};

	twentyFourSeven = async (): Promise<discord.Message<boolean> | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		try {
			let guild = await music_guild.findOne({ guildId: this.interaction.guildId });
			if (!guild) {
				guild = new music_guild({ guildId: this.interaction.guildId!, dj: null, songs: [], twentyFourSeven: true });
				await guild.save();
				return await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.twenty_four_seven_enabled'))] });
			}

			guild.twentyFourSeven = !guild.twentyFourSeven;
			await guild.save();
			const message = guild.twentyFourSeven ? this.t('responses.music.twenty_four_seven_enabled') : this.t('responses.music.twenty_four_seven_disabled');
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(message)] });
		} catch (error) {
			this.client.logger.error(`[MUSIC] 24/7 mode error: ${error}`);
			await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.twenty_four_seven_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)] });
		}
	};
}
