import discord from 'discord.js';

import { LocaleDetector } from '../locales';
import { ConfigManager } from '../../utils/config';
import { SpotifyManager, SpotifyAutoComplete } from '../music';

const configManager = ConfigManager.getInstance();

export class AutoComplete {
	private client: discord.Client;
	private interaction: discord.AutocompleteInteraction;
	private hasResponded = false;

	private static readonly SPOTIFY_REGEX = /^(https:\/\/open\.spotify\.com\/|spotify:)/i;
	private static readonly STRING_WITHOUT_HTTP_REGEX = /^(?!https?:\/\/)[\w\s]+$/;
	private static readonly SPOTIFY_TIMEOUT_MS = 2000;
	private static readonly MAX_CHOICE_NAME_LENGTH = 100;
	private static readonly MAX_CHOICES = 25;

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

	private getUserPlaylists = async (defaultText: string): Promise<void> => {
		const playlist = await this.manager.getPlaylists(this.interaction.user.id, 0, AutoComplete.MAX_CHOICES);
		if (playlist?.playlists.length) {
			const choices = playlist.playlists.slice(0, AutoComplete.MAX_CHOICES - 1).map((p) => ({ name: p.name.slice(0, AutoComplete.MAX_CHOICE_NAME_LENGTH), value: p.value }));
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

	public playAutocomplete = async (): Promise<void> => {
		const focused = this.interaction.options.getFocused(true);
		if (focused.name !== 'song') return;
		try {
			if (!focused.value?.trim()) {
				const t = await this.localeDetector.getTranslator(this.interaction);
				await this.getUserPlaylists(t('responses.default_search'));
				return;
			}
			const cleanValue = this.cleanSearchValue(focused.value);
			const shouldSearchSpotify = AutoComplete.SPOTIFY_REGEX.test(cleanValue) || AutoComplete.STRING_WITHOUT_HTTP_REGEX.test(cleanValue);
			if (shouldSearchSpotify) {
				try {
					const suggestions = await this.getSpotifySuggestions(cleanValue, this.interaction.user.id);
					await this.safeRespond(suggestions);
				} catch (error) {
					this.client.logger.warn(`[PLAY_AUTOCOMPLETE] Spotify error: ${error}`);
					await this.safeRespond([{ name: cleanValue.slice(0, AutoComplete.MAX_CHOICE_NAME_LENGTH), value: focused.value }]);
				}
			} else {
				await this.safeRespond([{ name: cleanValue.slice(0, AutoComplete.MAX_CHOICE_NAME_LENGTH), value: focused.value }]);
			}
		} catch (error) {
			this.client.logger.error(`[PLAY_AUTOCOMPLETE] Error: ${error}`);
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
