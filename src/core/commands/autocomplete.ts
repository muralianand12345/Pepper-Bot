import discord from 'discord.js';

import { LocaleDetector } from '../locales';
import Formatter from '../../utils/format';
import { ConfigManager } from '../../utils/config';
import { SpotifyManager, SpotifyAutoComplete, PlaylistDB, PlaylistService, formatPlaylistChoice, RadioService, searchCurated } from '../music';

const configManager = ConfigManager.getInstance();

export class AutoComplete {
	private client: discord.Client;
	private interaction: discord.AutocompleteInteraction;
	private hasResponded = false;

	private static readonly SPOTIFY_REGEX = /^(https:\/\/open\.spotify\.com\/|spotify:)/i;
	private static readonly STRING_WITHOUT_HTTP_REGEX = /^(?!https?:\/\/)[\w\s]+$/;
	private static readonly SPOTIFY_TIMEOUT_MS = 2000;
	private static readonly RADIO_TIMEOUT_MS = 2000;
	private static readonly MAX_CHOICE_NAME_LENGTH = 100;
	private static readonly MAX_CHOICES = 25;
	private static readonly PEPPER_PLAYLIST_SUFFIX = 'Pepper';

	private static manager: SpotifyManager | null = null;
	private static localeDetector: LocaleDetector | null = null;

	constructor(client: discord.Client, interaction: discord.AutocompleteInteraction) {
		this.client = client;
		this.interaction = interaction;
		// Lazy init shared instances
		AutoComplete.manager ??= new SpotifyManager(client);
		AutoComplete.localeDetector ??= new LocaleDetector();
	}

	private get manager(): SpotifyManager {
		return AutoComplete.manager!;
	}

	private get localeDetector(): LocaleDetector {
		return AutoComplete.localeDetector!;
	}

	private safeRespond = async (suggestions: discord.ApplicationCommandOptionChoiceData[]): Promise<boolean> => {
		if (this.hasResponded || !this.interaction.isAutocomplete()) return false;
		try {
			await this.interaction.respond(suggestions);
			this.hasResponded = true;
			return true;
		} catch (error) {
			this.client.logger.warn(`[AUTO_COMPLETE] Failed to respond: ${error}`);
			return false;
		}
	};

	private withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
		});
		return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
	};

	private getPepperPlaylistChoices = async (userId: string): Promise<discord.ApplicationCommandOptionChoiceData[]> => {
		const [summaries, limits] = await Promise.all([PlaylistDB.getSummaries({ ownerId: userId }), PlaylistService.getLimitsWithin(this.client, userId)]);
		return summaries.map((summary) => ({ name: formatPlaylistChoice(summary.name, summary.trackCount, limits?.songs ?? null, limits ? PlaylistService.isSummaryLocked(summary, summaries.length, limits) : false, AutoComplete.PEPPER_PLAYLIST_SUFFIX), value: PlaylistService.toPlayValue(summary.code) }));
	};

	private getPlaylistCodeChoice = async (value: string, asPlayValue: boolean): Promise<discord.ApplicationCommandOptionChoiceData | null> => {
		const code = PlaylistService.normalizeCode(value);
		if (!code) return null;

		const [summary] = await PlaylistDB.getSummaries({ code });
		if (!summary || !PlaylistService.canView(summary, this.interaction.user.id)) return null;
		return { name: formatPlaylistChoice(summary.name, summary.trackCount, null, false, AutoComplete.PEPPER_PLAYLIST_SUFFIX), value: asPlayValue ? PlaylistService.toPlayValue(summary.code) : summary.code };
	};

	private getUserPlaylists = async (defaultText: string): Promise<void> => {
		const userId = this.interaction.user.id;
		const [pepperChoices, spotifyPlaylists] = await Promise.all([
			this.getPepperPlaylistChoices(userId).catch((error): discord.ApplicationCommandOptionChoiceData[] => {
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

	private getSpotifySuggestions = async (query: string, userId: string): Promise<discord.ApplicationCommandOptionChoiceData[]> => {
		const userLanguage = (await this.localeDetector.getUserLanguage(userId)) || 'en';
		const spotifyAutoComplete = new SpotifyAutoComplete(this.client, configManager.getSpotifyClientId(), configManager.getSpotifyClientSecret(), userLanguage);
		const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Spotify API timeout')), AutoComplete.SPOTIFY_TIMEOUT_MS));
		return Promise.race([spotifyAutoComplete.getSuggestions(query), timeoutPromise]);
	};

	private cleanSearchValue = (value: string): string => {
		return value.split('?')[0].split('#')[0].trim();
	};

	private respondSongSuggestions = async (value: string, pinned: discord.ApplicationCommandOptionChoiceData | null = null): Promise<void> => {
		const respond = (choices: discord.ApplicationCommandOptionChoiceData[]) => this.safeRespond(pinned ? [pinned, ...choices].slice(0, AutoComplete.MAX_CHOICES) : choices);

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
		} catch (error) {
			this.client.logger.warn(`[PLAY_AUTOCOMPLETE] Spotify error: ${error}`);
			await respond(fallback);
		}
	};

	public playAutocomplete = async (): Promise<void> => {
		const focused = this.interaction.options.getFocused(true);
		if (focused.name !== 'song') return;
		try {
			if (!focused.value?.trim()) {
				const t = await this.localeDetector.getTranslator(this.interaction);
				await this.getUserPlaylists(t('responses.default_search'));
				return;
			}
			const pinned = await this.getPlaylistCodeChoice(focused.value, true).catch(() => null);
			await this.respondSongSuggestions(focused.value, pinned);
		} catch (error) {
			this.client.logger.error(`[PLAY_AUTOCOMPLETE] Error: ${error}`);
			await this.safeRespond([]);
		}
	};

	private respondOwnedPlaylists = async (value: string): Promise<void> => {
		const userId = this.interaction.user.id;
		const query = value.trim().toLowerCase();
		const [summaries, limits] = await Promise.all([PlaylistDB.getSummaries({ ownerId: userId }), PlaylistService.getLimitsWithin(this.client, userId)]);

		const choices: discord.ApplicationCommandOptionChoiceData[] = summaries
			.filter((summary) => !query || summary.name.toLowerCase().includes(query) || summary.code.toLowerCase().startsWith(query))
			.map((summary) => ({ name: formatPlaylistChoice(summary.name, summary.trackCount, limits?.songs ?? null, limits ? PlaylistService.isSummaryLocked(summary, summaries.length, limits) : false), value: summary.code }));

		const isView = !this.interaction.options.getSubcommandGroup(false) && this.interaction.options.getSubcommand(false) === 'view';
		if (isView) {
			const shared = await this.getPlaylistCodeChoice(value, false);
			if (shared && !choices.some((choice) => choice.value === shared.value)) choices.unshift(shared);
		}

		await this.safeRespond(choices.slice(0, AutoComplete.MAX_CHOICES));
	};

	private respondPlaylistPositions = async (value: string): Promise<void> => {
		const input = this.interaction.options.getString('playlist');
		const { playlist, owned } = input ? await PlaylistService.findForUser(this.interaction.user.id, input, false) : { playlist: null, owned: false };
		if (!playlist || !owned) {
			await this.safeRespond([]);
			return;
		}

		const query = value.trim().toLowerCase();
		const choices = playlist.tracks
			.map((track, index) => ({ name: Formatter.truncateText(`${index + 1}. ${track.title} - ${track.author}`, 97), value: index + 1 }))
			.filter((choice) => !query || String(choice.value).startsWith(query) || choice.name.toLowerCase().includes(query))
			.slice(0, AutoComplete.MAX_CHOICES);
		await this.safeRespond(choices);
	};

	public radioAutocomplete = async (): Promise<void> => {
		const focused = this.interaction.options.getFocused(true);
		if (focused.name !== 'station') return;

		const value = String(focused.value ?? '').trim();
		const countryCode = this.interaction.guild?.preferredLocale?.split('-')[1]?.toUpperCase() ?? null;

		try {
			const service = new RadioService(this.client);
			const result = await this.withTimeout(service.search(value, { countryCode }), AutoComplete.RADIO_TIMEOUT_MS, 'Radio search').catch((error) => {
				this.client.logger.warn(`[RADIO_AUTOCOMPLETE] Search failed: ${error}`);
				return { status: 'ok' as const, stations: searchCurated(value, countryCode) };
			});

			const choices = result.stations.slice(0, AutoComplete.MAX_CHOICES).map((station) => ({
				name: Formatter.truncateText(`${station.source === 'curated' ? '⭐ ' : ''}${station.name} — ${station.genre}${station.country ? ` (${station.country})` : ''}`, AutoComplete.MAX_CHOICE_NAME_LENGTH - 3),
				value: station.id,
			}));

			await this.safeRespond(choices);
		} catch (error) {
			this.client.logger.error(`[RADIO_AUTOCOMPLETE] Error: ${error}`);
			await this.safeRespond([]);
		}
	};

	public playlistAutocomplete = async (): Promise<void> => {
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
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_AUTOCOMPLETE] Error: ${error}`);
			await this.safeRespond([]);
		}
	};

	public languageAutocomplete = async (): Promise<void> => {
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

	public helpAutocomplete = async (): Promise<void> => {
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
}
