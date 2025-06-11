"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocaleDetector = void 0;
const pepper_1 = __importDefault(require("../../pepper"));
const manager_1 = require("./manager");
const music_user_1 = __importDefault(require("../../events/database/schema/music_user"));
const music_guild_1 = __importDefault(require("../../events/database/schema/music_guild"));
class LocaleDetector {
    constructor() {
        this.getUserLanguage = async (userId) => {
            try {
                const user = await music_user_1.default.findOne({ userId });
                return user?.language || null;
            }
            catch (error) {
                pepper_1.default.logger.error(`[LOCALE_DETECTOR] Error getting user language: ${error}`);
                return null;
            }
        };
        this.getGuildLanguage = async (guildId) => {
            try {
                const guild = await music_guild_1.default.findOne({ guildId });
                return guild?.language || null;
            }
            catch (error) {
                pepper_1.default.logger.error(`[LOCALE_DETECTOR] Error getting guild language: ${error}`);
                return null;
            }
        };
        this.setUserLanguage = async (userId, language) => {
            try {
                await music_user_1.default.findOneAndUpdate({ userId }, { language }, { upsert: true, new: true });
                return true;
            }
            catch (error) {
                pepper_1.default.logger.error(`[LOCALE_DETECTOR] Error setting user language: ${error}`);
                return false;
            }
        };
        this.setGuildLanguage = async (guildId, language) => {
            try {
                await music_guild_1.default.findOneAndUpdate({ guildId }, { language }, { upsert: true, new: true });
                return true;
            }
            catch (error) {
                pepper_1.default.logger.error(`[LOCALE_DETECTOR] Error setting guild language: ${error}`);
                return false;
            }
        };
        this.detectLocale = async (interaction) => {
            try {
                const userLanguage = await this.getUserLanguage(interaction.user.id);
                if (userLanguage && this.localizationManager.isLocaleSupported(userLanguage))
                    return userLanguage;
                if (interaction.guildId) {
                    const guildLanguage = await this.getGuildLanguage(interaction.guildId);
                    if (guildLanguage && this.localizationManager.isLocaleSupported(guildLanguage))
                        return guildLanguage;
                }
                const discordLocale = this.localizationManager.mapDiscordLocaleToOurs(interaction.locale);
                if (this.localizationManager.isLocaleSupported(discordLocale))
                    return discordLocale;
                return 'en';
            }
            catch (error) {
                pepper_1.default.logger.error(`[LOCALE_DETECTOR] Error detecting locale: ${error}`);
                return 'en';
            }
        };
        this.getTranslator = async (interaction) => {
            const locale = await this.detectLocale(interaction);
            return (key, data) => {
                return this.localizationManager.translate(key, locale, data);
            };
        };
        this.isLanguageSupported = (language) => {
            return this.localizationManager.isLocaleSupported(language);
        };
        this.getSupportedLanguages = () => {
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
        this.localizationManager = manager_1.LocalizationManager.getInstance();
    }
}
exports.LocaleDetector = LocaleDetector;
