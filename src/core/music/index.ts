import discord from 'discord.js';
import magmastream from 'magmastream';

import { LocaleDetector } from '../locales';
import { MusicResponseHandler, VoiceChannelValidator, MusicPlayerValidator, Autoplay } from './handlers';

export * from './func';
export * from './repo';
export * from './handlers';
export * from './auto_search';
export * from './now_playing';

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

	private validateLavalinkNode = async (nodeChoice: string | undefined): Promise<discord.EmbedBuilder | null> => {
		if (!nodeChoice) return null;
		if (this.client.manager.get(this.interaction.guild?.id || '')) return new MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.player_exists'), this.locale);

		const node = this.client.manager.nodes.find((n: magmastream.Node) => n.options.identifier === nodeChoice);
		if (!node) return new MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.node_invalid'), this.locale);
		if (!node.connected) return new MusicResponseHandler(this.client).createErrorEmbed(this.t('responses.errors.node_not_connected'), this.locale);
		return null;
	};

	private validateFilterName = (filterName: string): filterName is keyof typeof MUSIC_CONFIG.AUDIO_FILTERS => {
		return filterName in MUSIC_CONFIG.AUDIO_FILTERS;
	};

	private lavaSearch = async (query: string, retry: number = 5): Promise<magmastream.SearchResult> => {
		let res: magmastream.SearchResult;
		res = await this.client.manager.search(query, this.interaction.user.id);
		if (res.loadType === 'error' && retry > 0) {
			this.client.logger.warn(`[MUSIC] Error searching songs. Retrying... (${retry} attempts left)`);
			return this.lavaSearch(query, retry - 1);
		}
		return res;
	};

	searchResults = async (res: magmastream.SearchResult, player: magmastream.Player): Promise<discord.Message<boolean> | void> => {
		const responseHandler = new MusicResponseHandler(this.client);

		switch (res.loadType) {
			case 'empty': {
				if (!player.queue.current) player.destroy();
				await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_results'), this.locale)] });
				break;
			}
			case 'track':
			case 'search': {
				const track = res.tracks[0];
				player.queue.add(track);
				if (!player.playing && !player.paused && !player.queue.size) player.play();
				await this.interaction.editReply({ embeds: [responseHandler.createTrackEmbed(track, player.queue.size, this.locale)] });
				break;
			}
			case 'playlist': {
				if (!res.playlist) break;
				res.playlist.tracks.forEach((track: magmastream.Track) => player.queue.add(track));
				if (!player.playing && !player.paused && player.queue.totalSize === res.playlist.tracks.length) player.play();
				await this.interaction.editReply({ embeds: [responseHandler.createPlaylistEmbed(res.playlist, this.interaction.user, this.locale)] });
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

		const query = this.interaction.options.getString('song') || this.t('responses.default_search');
		const nodeChoice = this.interaction.options.getString('lavalink_node') || undefined;

		const nodeCheck = await this.validateLavalinkNode(nodeChoice);
		if (nodeCheck) return await this.interaction.editReply({ embeds: [nodeCheck] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection()]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		const guildMember = this.interaction.guild?.members.cache.get(this.interaction.user.id);
		const player = this.client.manager.create({
			guildId: this.interaction.guildId || '',
			voiceChannelId: guildMember?.voice.channelId || '',
			textChannelId: this.interaction.channelId,
			node: nodeChoice,
			...MUSIC_CONFIG.PLAYER_OPTIONS,
		});

		const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
		if (!playerValid) return await this.interaction.editReply({ embeds: [playerEmbed] });

		const musicValidator = new MusicPlayerValidator(this.client, player);
		const [queueValid, queueError] = await musicValidator.validateMusicSource(query, this.interaction);
		if (!queueValid && queueError) return this.interaction.editReply({ embeds: [queueError] });

		if (!['CONNECTING', 'CONNECTED'].includes(player.state)) {
			player.connect();
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.connected', { channelName: guildMember?.voice.channel?.name || 'Unknown' }), this.locale)] });
		}

		try {
			const res = await this.lavaSearch(query);
			if (res.loadType === 'error') throw new Error('No results found | loadType: error');
			await this.searchResults(res, player);
		} catch (error) {
			this.client.logger.error(`[MUSIC] Play error: ${error}`);
			await this.interaction.followUp({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.play_error'), this.locale, true)], components: [responseHandler.getSupportButton(this.locale)], flags: discord.MessageFlags.Ephemeral });
		}
	};

	stop = async (): Promise<discord.Message | void> => {
		await this.interaction.deferReply();

		await this.initializeLocale();
		const responseHandler = new MusicResponseHandler(this.client);

		const musicCheck = this.validateMusicEnabled();
		if (musicCheck) return await this.interaction.editReply({ embeds: [musicCheck] });

		const player = this.client.manager.get(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		try {
			player.destroy();
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.stopped'), this.locale)] });
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

		const player = this.client.manager.get(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		const musicValidator = new MusicPlayerValidator(this.client, player);
		const [isValid, errorEmbed] = await musicValidator.validatePauseState(this.interaction);
		if (!isValid && errorEmbed) return await this.interaction.editReply({ embeds: [errorEmbed] });

		try {
			player.pause(true);
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.paused'), this.locale)] });
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

		const player = this.client.manager.get(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		const musicValidator = new MusicPlayerValidator(this.client, player);
		const [isValid, errorEmbed] = await musicValidator.validateResumeState(this.interaction);
		if (!isValid && errorEmbed) return await this.interaction.editReply({ embeds: [errorEmbed] });

		try {
			player.pause(false);
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.resumed'), this.locale)] });
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

		const player = this.client.manager.get(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		const musicValidator = new MusicPlayerValidator(this.client, player);
		const [isValid, errorEmbed] = await musicValidator.validateQueueSize(1, this.interaction);
		if (!isValid && errorEmbed) return await this.interaction.editReply({ embeds: [errorEmbed] });

		try {
			player.stop(1);
			if (player.queue.size === 0 && this.interaction.guildId) player.destroy();
			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(this.t('responses.music.skipped'), this.locale)] });
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

		const player = this.client.manager.get(this.interaction.guild?.id || '');
		if (!player) return await this.interaction.editReply({ embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.no_player'), this.locale)] });

		const validator = new VoiceChannelValidator(this.client, this.interaction);
		for (const check of [validator.validateGuildContext(), validator.validateVoiceConnection(), validator.validateMusicPlaying(player), validator.validateVoiceSameChannel(player)]) {
			const [isValid, embed] = await check;
			if (!isValid) return await this.interaction.editReply({ embeds: [embed] });
		}

		try {
			player.setTrackRepeat(!player.trackRepeat);
			const message = player.trackRepeat ? this.t('responses.music.loop_enabled') : this.t('responses.music.loop_disabled');

			await this.interaction.editReply({ embeds: [responseHandler.createSuccessEmbed(message, this.locale)] });
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

		const player = this.client.manager.get(this.interaction.guild?.id || '');
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
			const autoplayManager = Autoplay.getInstance(player.guildId, player, this.client);
			if (enable) {
				autoplayManager.enable(this.interaction.user.id);
				const embed = responseHandler.createSuccessEmbed(this.t('responses.music.autoplay_enabled'), this.locale);
				await this.interaction.editReply({ embeds: [embed] });
			} else {
				autoplayManager.disable();
				const embed = responseHandler.createInfoEmbed(this.t('responses.music.autoplay_disabled'), this.locale);
				await this.interaction.editReply({ embeds: [embed] });
			}
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

		const player = this.client.manager.get(this.interaction.guild?.id || '');
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
				player.filters = new magmastream.Filters(player);
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
			const embed = responseHandler.createSuccessEmbed(this.t('responses.music.filter_applied', { filter: filter.name }), this.locale);
			await this.interaction.editReply({ embeds: [embed] });
		} catch (error) {
			this.client.logger.error(`[FILTER] Command error: ${error}`);
			await this.interaction.editReply({
				embeds: [responseHandler.createErrorEmbed(this.t('responses.errors.filter_error'), this.locale, true)],
				components: [responseHandler.getSupportButton(this.locale)],
			});
		}
	};
}
