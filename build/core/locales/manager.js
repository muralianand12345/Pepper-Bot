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
        this.defaultLocale = "en";
        this.loadAllLocales = () => {
            if (!fs_1.default.existsSync(this.localesPath)) {
                fs_1.default.mkdirSync(this.localesPath, { recursive: true });
                return;
            }
            const files = fs_1.default.readdirSync(this.localesPath).filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
            for (const file of files) {
                const locale = path_1.default.basename(file, path_1.default.extname(file));
                this.loadLocale(locale);
            }
        };
        this.loadLocale = (locale) => {
            const filePath = path_1.default.join(this.localesPath, `${locale}.yml`);
            if (!fs_1.default.existsSync(filePath)) {
                const yamlPath = path_1.default.join(this.localesPath, `${locale}.yaml`);
                if (!fs_1.default.existsSync(yamlPath))
                    return;
                const content = fs_1.default.readFileSync(yamlPath, 'utf8');
                const data = yaml_1.default.parse(content);
                this.locales.set(locale, data);
                return;
            }
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            const data = yaml_1.default.parse(content);
            this.locales.set(locale, data);
        };
        this.reloadLocales = () => {
            this.locales.clear();
            this.loadAllLocales();
        };
        this.getSupportedLocales = () => {
            return Array.from(this.locales.keys());
        };
        this.isLocaleSupported = (locale) => {
            return this.locales.has(locale);
        };
        this.getNestedValue = (obj, path) => {
            return path.split('.').reduce((current, key) => {
                return current && current[key] !== undefined ? current[key] : null;
            }, obj);
        };
        this.interpolate = (text, data = {}) => {
            return text.replace(/\{(\w+)\}/g, (match, key) => {
                return data[key] !== undefined ? String(data[key]) : match;
            });
        };
        this.translate = (key, locale = this.defaultLocale, data = {}) => {
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
                if (translation) {
                    const discordLocale = this.mapToDiscordLocale(locale);
                    if (discordLocale)
                        localizations[discordLocale] = translation;
                }
            }
            return localizations;
        };
        this.mapToDiscordLocale = (locale) => {
            const mapping = {
                'en': discord_js_1.default.Locale.EnglishUS,
                'es': discord_js_1.default.Locale.SpanishES,
                'fr': discord_js_1.default.Locale.French,
                'de': discord_js_1.default.Locale.German,
                'pt': discord_js_1.default.Locale.PortugueseBR,
                'ja': discord_js_1.default.Locale.Japanese,
                'ko': discord_js_1.default.Locale.Korean,
                'zh': discord_js_1.default.Locale.ChineseCN,
                'ru': discord_js_1.default.Locale.Russian,
                'it': discord_js_1.default.Locale.Italian,
                'nl': discord_js_1.default.Locale.Dutch,
                'pl': discord_js_1.default.Locale.Polish,
                'tr': discord_js_1.default.Locale.Turkish,
                'sv': discord_js_1.default.Locale.Swedish,
                'no': discord_js_1.default.Locale.Norwegian,
                'da': discord_js_1.default.Locale.Danish,
                'fi': discord_js_1.default.Locale.Finnish,
                'cs': discord_js_1.default.Locale.Czech,
                'bg': discord_js_1.default.Locale.Bulgarian,
                'uk': discord_js_1.default.Locale.Ukrainian,
                'hr': discord_js_1.default.Locale.Croatian,
                'ro': discord_js_1.default.Locale.Romanian,
                'lt': discord_js_1.default.Locale.Lithuanian,
                'el': discord_js_1.default.Locale.Greek,
                'hu': discord_js_1.default.Locale.Hungarian,
                'th': discord_js_1.default.Locale.Thai,
                'vi': discord_js_1.default.Locale.Vietnamese,
                'hi': discord_js_1.default.Locale.Hindi,
                'id': discord_js_1.default.Locale.Indonesian,
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
        this.localesPath = path_1.default.join(__dirname, "../../../locales");
        this.loadAllLocales();
    }
}
exports.LocalizationManager = LocalizationManager;
LocalizationManager.getInstance = () => {
    if (!LocalizationManager.instance)
        LocalizationManager.instance = new LocalizationManager();
    return LocalizationManager.instance;
};
;
