"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalizationManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const discord_js_1 = __importDefault(require("discord.js"));
class LocalizationManager {
    constructor() {
        this.locales = new Map();
        this.defaultLocale = 'en';
        this.validationErrors = new Map();
        this.loadAllLocales = () => {
            if (!fs_1.default.existsSync(this.localesPath)) {
                fs_1.default.mkdirSync(this.localesPath, { recursive: true });
                return;
            }
            const files = fs_1.default.readdirSync(this.localesPath).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));
            if (files.length === 0)
                return;
            for (const file of files) {
                const locale = path_1.default.basename(file, path_1.default.extname(file));
                this.loadLocale(locale);
            }
        };
        this.loadLocale = (locale) => {
            const yamlPath = path_1.default.join(this.localesPath, `${locale}.yaml`);
            const ymlPath = path_1.default.join(this.localesPath, `${locale}.yml`);
            const filePath = fs_1.default.existsSync(ymlPath) ? ymlPath : yamlPath;
            if (!fs_1.default.existsSync(filePath))
                return;
            try {
                const content = fs_1.default.readFileSync(filePath, 'utf8');
                const data = yaml_1.default.parse(content);
                if (!data || typeof data !== 'object')
                    throw new Error(`Invalid locale data in ${locale}: data is not an object`);
                this.locales.set(locale, data);
            }
            catch (error) {
                throw new Error(`[LOCALIZATION] Failed to load locale '${locale}': ${error instanceof Error ? error.message : String(error)}`);
            }
        };
        this.validateAllLocales = () => {
            const englishLocale = this.locales.get(this.defaultLocale);
            if (!englishLocale)
                throw new Error(`[LOCALIZATION] Default locale '${this.defaultLocale}' not found`);
            const englishKeys = this.getAllKeys(englishLocale);
            for (const [locale, data] of this.locales) {
                if (locale === this.defaultLocale)
                    continue;
                const localeKeys = this.getAllKeys(data);
                const missingKeys = englishKeys.filter((key) => !localeKeys.includes(key));
                const extraKeys = localeKeys.filter((key) => !englishKeys.includes(key));
                if (missingKeys.length > 0 || extraKeys.length > 0) {
                    const errors = [];
                    if (missingKeys.length > 0)
                        errors.push(`Missing keys: ${missingKeys.join(', ')}`);
                    if (extraKeys.length > 0)
                        errors.push(`Extra keys: ${extraKeys.join(', ')}`);
                    this.validationErrors.set(locale, errors);
                }
            }
        };
        this.getAllKeys = (obj, prefix = '') => {
            const keys = [];
            for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    keys.push(...this.getAllKeys(value, fullKey));
                }
                else {
                    keys.push(fullKey);
                }
            }
            return keys;
        };
        this.reloadLocales = () => {
            this.locales.clear();
            this.validationErrors.clear();
            this.loadAllLocales();
            this.validateAllLocales();
        };
        this.getSupportedLocales = () => {
            return Array.from(this.locales.keys());
        };
        this.isLocaleSupported = (locale) => {
            return this.locales.has(locale);
        };
        this.getValidationErrors = (locale) => {
            if (locale)
                return this.validationErrors.get(locale) || [];
            return this.validationErrors;
        };
        this.getNestedValue = (obj, path) => {
            try {
                return path.split('.').reduce((current, key) => {
                    return current && current[key] !== undefined ? current[key] : null;
                }, obj);
            }
            catch (error) {
                return null;
            }
        };
        this.interpolate = (text, data = {}) => {
            if (typeof text !== 'string')
                return String(text || '');
            try {
                return text.replace(/\{(\w+)\}/g, (match, key) => {
                    const value = data[key];
                    return value !== undefined ? String(value) : match;
                });
            }
            catch (error) {
                return text;
            }
        };
        this.translate = (key, locale = this.defaultLocale, data = {}) => {
            if (!key)
                return '';
            let localeData = this.locales.get(locale);
            let translation = localeData ? this.getNestedValue(localeData, key) : null;
            if (!translation && locale !== this.defaultLocale) {
                localeData = this.locales.get(this.defaultLocale);
                translation = localeData ? this.getNestedValue(localeData, key) : null;
            }
            if (!translation)
                return key;
            return this.interpolate(translation, data);
        };
        this.getCommandLocalizations = (key) => {
            const localizations = {};
            for (const [locale, data] of this.locales) {
                if (locale === this.defaultLocale)
                    continue;
                const translation = this.getNestedValue(data, key);
                if (translation && typeof translation === 'string') {
                    const discordLocale = this.mapToDiscordLocale(locale);
                    if (discordLocale)
                        localizations[discordLocale] = translation;
                }
            }
            return localizations;
        };
        this.mapToDiscordLocale = (locale) => {
            const mapping = {
                en: discord_js_1.default.Locale.EnglishUS,
                es: discord_js_1.default.Locale.SpanishES,
                fr: discord_js_1.default.Locale.French,
                de: discord_js_1.default.Locale.German,
                pt: discord_js_1.default.Locale.PortugueseBR,
                ja: discord_js_1.default.Locale.Japanese,
                ko: discord_js_1.default.Locale.Korean,
                zh: discord_js_1.default.Locale.ChineseCN,
                ru: discord_js_1.default.Locale.Russian,
                it: discord_js_1.default.Locale.Italian,
                nl: discord_js_1.default.Locale.Dutch,
                pl: discord_js_1.default.Locale.Polish,
                tr: discord_js_1.default.Locale.Turkish,
                sv: discord_js_1.default.Locale.Swedish,
                no: discord_js_1.default.Locale.Norwegian,
                da: discord_js_1.default.Locale.Danish,
                fi: discord_js_1.default.Locale.Finnish,
                cs: discord_js_1.default.Locale.Czech,
                bg: discord_js_1.default.Locale.Bulgarian,
                uk: discord_js_1.default.Locale.Ukrainian,
                hr: discord_js_1.default.Locale.Croatian,
                ro: discord_js_1.default.Locale.Romanian,
                lt: discord_js_1.default.Locale.Lithuanian,
                el: discord_js_1.default.Locale.Greek,
                hu: discord_js_1.default.Locale.Hungarian,
                th: discord_js_1.default.Locale.Thai,
                vi: discord_js_1.default.Locale.Vietnamese,
                hi: discord_js_1.default.Locale.Hindi,
                id: discord_js_1.default.Locale.Indonesian,
            };
            return mapping[locale] || null;
        };
        this.mapDiscordLocaleToOurs = (discordLocale) => {
            const mapping = {
                [discord_js_1.default.Locale.EnglishUS]: 'en',
                [discord_js_1.default.Locale.EnglishGB]: 'en',
                [discord_js_1.default.Locale.SpanishES]: 'es',
                [discord_js_1.default.Locale.French]: 'fr',
                [discord_js_1.default.Locale.German]: 'de',
                [discord_js_1.default.Locale.PortugueseBR]: 'pt',
                [discord_js_1.default.Locale.Japanese]: 'ja',
                [discord_js_1.default.Locale.Korean]: 'ko',
                [discord_js_1.default.Locale.ChineseCN]: 'zh',
                [discord_js_1.default.Locale.Russian]: 'ru',
                [discord_js_1.default.Locale.Italian]: 'it',
                [discord_js_1.default.Locale.Dutch]: 'nl',
                [discord_js_1.default.Locale.Polish]: 'pl',
                [discord_js_1.default.Locale.Turkish]: 'tr',
                [discord_js_1.default.Locale.Swedish]: 'sv',
                [discord_js_1.default.Locale.Norwegian]: 'no',
                [discord_js_1.default.Locale.Danish]: 'da',
                [discord_js_1.default.Locale.Finnish]: 'fi',
                [discord_js_1.default.Locale.Czech]: 'cs',
                [discord_js_1.default.Locale.Bulgarian]: 'bg',
                [discord_js_1.default.Locale.Ukrainian]: 'uk',
                [discord_js_1.default.Locale.Croatian]: 'hr',
                [discord_js_1.default.Locale.Romanian]: 'ro',
                [discord_js_1.default.Locale.Lithuanian]: 'lt',
                [discord_js_1.default.Locale.Greek]: 'el',
                [discord_js_1.default.Locale.Hungarian]: 'hu',
                [discord_js_1.default.Locale.Thai]: 'th',
                [discord_js_1.default.Locale.Vietnamese]: 'vi',
                [discord_js_1.default.Locale.Hindi]: 'hi',
                [discord_js_1.default.Locale.Indonesian]: 'id',
            };
            return mapping[discordLocale] || this.defaultLocale;
        };
        this.validateLocaleCompleteness = (locale) => {
            const englishLocale = this.locales.get(this.defaultLocale);
            const targetLocale = this.locales.get(locale);
            if (!englishLocale || !targetLocale)
                return { missingKeys: [], extraKeys: [], isComplete: false };
            const englishKeys = this.getAllKeys(englishLocale);
            const targetKeys = this.getAllKeys(targetLocale);
            const missingKeys = englishKeys.filter((key) => !targetKeys.includes(key));
            const extraKeys = targetKeys.filter((key) => !englishKeys.includes(key));
            return { missingKeys, extraKeys, isComplete: missingKeys.length === 0 && extraKeys.length === 0 };
        };
        this.getLocaleStats = () => {
            const stats = {};
            const englishLocale = this.locales.get(this.defaultLocale);
            if (!englishLocale)
                return stats;
            const totalEnglishKeys = this.getAllKeys(englishLocale).length;
            for (const [locale, _data] of this.locales) {
                if (locale === this.defaultLocale) {
                    stats[locale] = { totalKeys: totalEnglishKeys, missingKeys: 0, completeness: 100 };
                    continue;
                }
                const validation = this.validateLocaleCompleteness(locale);
                const completeness = Math.round(((totalEnglishKeys - validation.missingKeys.length) / totalEnglishKeys) * 100);
                stats[locale] = { totalKeys: totalEnglishKeys, missingKeys: validation.missingKeys.length, completeness };
            }
            return stats;
        };
        this.localesPath = path_1.default.join(__dirname, '../../../locales');
        this.loadAllLocales();
        this.validateAllLocales();
    }
}
exports.LocalizationManager = LocalizationManager;
LocalizationManager.getInstance = () => {
    if (!LocalizationManager.instance)
        LocalizationManager.instance = new LocalizationManager();
    return LocalizationManager.instance;
};
