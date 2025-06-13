import discord from 'discord.js';

import client from '../../pepper';
import { LocalizationManager } from './manager';
import music_user from '../../events/database/schema/music_user';
import music_guild from '../../events/database/schema/music_guild';

export class LocaleDetector {
	private localizationManager: LocalizationManager;
	private readonly supportedLanguages: Array<{ code: string; name: string }>;

	constructor() {
		this.localizationManager = LocalizationManager.getInstance();
		this.supportedLanguages = this.initializeSupportedLanguages();
	}

	private initializeSupportedLanguages = (): Array<{ code: string; name: string }> => {
		const allLanguages = [
			{ code: 'en', name: 'English' },
			{ code: 'es', name: 'Español' },
			{ code: 'fr', name: 'Français' },
			{ code: 'de', name: 'Deutsch' },
			{ code: 'pt', name: 'Português' },
			{ code: 'ja', name: '日本語' },
			{ code: 'ko', name: '한국어' },
			{ code: 'zh', name: '中文' },
			{ code: 'ru', name: 'Русский' },
			{ code: 'it', name: 'Italiano' },
			{ code: 'nl', name: 'Nederlands' },
			{ code: 'pl', name: 'Polski' },
			{ code: 'tr', name: 'Türkçe' },
			{ code: 'sv', name: 'Svenska' },
			{ code: 'no', name: 'Norsk' },
			{ code: 'da', name: 'Dansk' },
			{ code: 'fi', name: 'Suomi' },
			{ code: 'cs', name: 'Čeština' },
			{ code: 'bg', name: 'Български' },
			{ code: 'uk', name: 'Українська' },
			{ code: 'hr', name: 'Hrvatski' },
			{ code: 'ro', name: 'Română' },
			{ code: 'lt', name: 'Lietuvių' },
			{ code: 'el', name: 'Ελληνικά' },
			{ code: 'hu', name: 'Magyar' },
			{ code: 'th', name: 'ไทย' },
			{ code: 'vi', name: 'Tiếng Việt' },
			{ code: 'hi', name: 'हिन्दी' },
			{ code: 'id', name: 'Bahasa Indonesia' },
		];

		const supportedCodes = this.localizationManager.getSupportedLocales();
		const filteredLanguages = allLanguages.filter((lang) => supportedCodes.includes(lang.code));
		return filteredLanguages;
	};

	private validateLanguageCode = (language: string): boolean => {
		if (!language || typeof language !== 'string') return false;
		return this.supportedLanguages.some((lang) => lang.code === language);
	};

	public getUserLanguage = async (userId: string): Promise<string | null> => {
		try {
			if (!userId) return null;
			const user = await music_user.findOne({ userId }).lean();
			const language = user?.language;
			if (language && !this.validateLanguageCode(language)) {
				await this.setUserLanguage(userId, null);
				return null;
			}
			return language || null;
		} catch (error) {
			client.logger.error(`[LOCALE_DETECTOR] Error getting user language for ${userId}: ${error}`);
			return null;
		}
	};

	public getGuildLanguage = async (guildId: string): Promise<string | null> => {
		try {
			if (!guildId) return null;
			const guild = await music_guild.findOne({ guildId }).lean();
			const language = guild?.language;
			if (language && !this.validateLanguageCode(language)) {
				await this.setGuildLanguage(guildId, null);
				return null;
			}
			return language || null;
		} catch (error) {
			client.logger.error(`[LOCALE_DETECTOR] Error getting guild language for ${guildId}: ${error}`);
			return null;
		}
	};

	public setUserLanguage = async (userId: string, language: string | null): Promise<boolean> => {
		try {
			if (!userId) return false;
			if (language && !this.validateLanguageCode(language)) return false;

			await music_user.findOneAndUpdate({ userId }, { language }, { upsert: true, new: true });
			return true;
		} catch (error) {
			client.logger.error(`[LOCALE_DETECTOR] Error setting user language for ${userId}: ${error}`);
			return false;
		}
	};

	public setGuildLanguage = async (guildId: string, language: string | null): Promise<boolean> => {
		try {
			if (!guildId) return false;
			if (language && !this.validateLanguageCode(language)) return false;

			await music_guild.findOneAndUpdate({ guildId }, { language }, { upsert: true, new: true });
			return true;
		} catch (error) {
			client.logger.error(`[LOCALE_DETECTOR] Error setting guild language for ${guildId}: ${error}`);
			return false;
		}
	};

	public detectLocale = async (interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction | discord.AutocompleteInteraction | discord.ModalSubmitInteraction | discord.SelectMenuInteraction | discord.MessageComponentInteraction): Promise<string> => {
		try {
			const userLanguage = await this.getUserLanguage(interaction.user.id);
			if (userLanguage && this.localizationManager.isLocaleSupported(userLanguage)) return userLanguage;

			if (interaction.guildId) {
				const guildLanguage = await this.getGuildLanguage(interaction.guildId);
				if (guildLanguage && this.localizationManager.isLocaleSupported(guildLanguage)) return guildLanguage;
			}

			const discordLocale = this.localizationManager.mapDiscordLocaleToOurs(interaction.locale);
			if (this.localizationManager.isLocaleSupported(discordLocale)) return discordLocale;

			return 'en';
		} catch (error) {
			client.logger.error(`[LOCALE_DETECTOR] Error detecting locale: ${error}`);
			return 'en';
		}
	};

	public getTranslator = async (interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction | discord.AutocompleteInteraction | discord.ModalSubmitInteraction | discord.SelectMenuInteraction | discord.MessageComponentInteraction) => {
		const locale = await this.detectLocale(interaction);
		return (key: string, data?: Record<string, string | number>) => {
			return this.localizationManager.translate(key, locale, data);
		};
	};

	public isLanguageSupported = (language: string): boolean => {
		return this.validateLanguageCode(language);
	};

	public getSupportedLanguages = (): Array<{ code: string; name: string }> => {
		return [...this.supportedLanguages];
	};

	public getLanguageStats = (): { total: number; supported: number; missing: number; supportedCodes: string[]; missingCodes: string[] } => {
		const allCodes = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'ru', 'it', 'nl', 'pl', 'tr', 'sv', 'no', 'da', 'fi', 'cs', 'bg', 'uk', 'hr', 'ro', 'lt', 'el', 'hu', 'th', 'vi', 'hi', 'id'];

		const supportedCodes = this.supportedLanguages.map((lang) => lang.code);
		const missingCodes = allCodes.filter((code) => !supportedCodes.includes(code));
		return { total: allCodes.length, supported: supportedCodes.length, missing: missingCodes.length, supportedCodes, missingCodes };
	};

	public validateUserLanguage = async (userId: string): Promise<{ isValid: boolean; currentLanguage: string | null; needsUpdate: boolean }> => {
		const currentLanguage = await this.getUserLanguage(userId);
		if (!currentLanguage) return { isValid: true, currentLanguage: null, needsUpdate: false };
		const isValid = this.validateLanguageCode(currentLanguage);
		return { isValid, currentLanguage, needsUpdate: !isValid };
	};

	public validateGuildLanguage = async (guildId: string): Promise<{ isValid: boolean; currentLanguage: string | null; needsUpdate: boolean }> => {
		const currentLanguage = await this.getGuildLanguage(guildId);
		if (!currentLanguage) return { isValid: true, currentLanguage: null, needsUpdate: false };

		const isValid = this.validateLanguageCode(currentLanguage);
		return { isValid, currentLanguage, needsUpdate: !isValid };
	};

	public getAvailableLanguagesForUser = (query: string = ''): Array<{ code: string; name: string }> => {
		const lowerQuery = query.toLowerCase();
		return this.supportedLanguages.filter((lang) => lang.name.toLowerCase().includes(lowerQuery) || lang.code.toLowerCase().includes(lowerQuery));
	};

	public getLocaleFromDiscordLocale = (discordLocale: string): string => {
		const mappedLocale = this.localizationManager.mapDiscordLocaleToOurs(discordLocale);
		if (this.localizationManager.isLocaleSupported(mappedLocale)) return mappedLocale;
		return 'en';
	};
}
