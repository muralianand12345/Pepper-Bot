import discord from "discord.js";

import client from "../../pepper";
import { LocalizationManager } from "./manager";
import music_user from "../../events/database/schema/music_user";
import music_guild from "../../events/database/schema/music_guild";


export class LocaleDetector {
    private localizationManager: LocalizationManager;

    constructor() {
        this.localizationManager = LocalizationManager.getInstance();
    }

    public getUserLanguage = async (userId: string): Promise<string | null> => {
        try {
            const user = await music_user.findOne({ userId });
            return user?.language || null;
        } catch (error) {
            client.logger.error(`[LOCALE_DETECTOR] Error getting user language: ${error}`);
            return null;
        }
    };

    public getGuildLanguage = async (guildId: string): Promise<string | null> => {
        try {
            const guild = await music_guild.findOne({ guildId });
            return guild?.language || null;
        } catch (error) {
            client.logger.error(`[LOCALE_DETECTOR] Error getting guild language: ${error}`);
            return null;
        }
    };

    public setUserLanguage = async (userId: string, language: string | null): Promise<boolean> => {
        try {
            await music_user.findOneAndUpdate({ userId }, { language }, { upsert: true, new: true });
            return true;
        } catch (error) {
            client.logger.error(`[LOCALE_DETECTOR] Error setting user language: ${error}`);
            return false;
        }
    };

    public setGuildLanguage = async (guildId: string, language: string | null): Promise<boolean> => {
        try {
            await music_guild.findOneAndUpdate({ guildId }, { language }, { upsert: true, new: true });
            return true;
        } catch (error) {
            client.logger.error(`[LOCALE_DETECTOR] Error setting guild language: ${error}`);
            return false;
        }
    };

    public detectLocale = async (
        interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction | discord.AutocompleteInteraction | discord.ModalSubmitInteraction
    ): Promise<string> => {
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

    public getTranslator = async (
        interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction | discord.AutocompleteInteraction | discord.ModalSubmitInteraction
    ) => {
        const locale = await this.detectLocale(interaction);
        return (key: string, data?: Record<string, string | number>) => {
            return this.localizationManager.translate(key, locale, data);
        };
    };

    public isLanguageSupported = (language: string): boolean => {
        return this.localizationManager.isLocaleSupported(language);
    };

    public getSupportedLanguages = (): Array<{ code: string; name: string }> => {
        const languages = [
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
            { code: 'id', name: 'Bahasa Indonesia' }
        ];

        const supportedCodes = this.localizationManager.getSupportedLocales();
        return languages.filter(lang => supportedCodes.includes(lang.code));
    };
}