import fs from "fs";
import path from "path";
import yaml from "yaml";
import discord from "discord.js";

import { LocaleData, InterpolationData } from "../../types";


export class LocalizationManager {
    private static instance: LocalizationManager;
    private locales: Map<string, LocaleData> = new Map();
    private readonly defaultLocale: string = "en";
    private readonly localesPath: string;
    private validationErrors: Map<string, string[]> = new Map();

    private constructor() {
        this.localesPath = path.join(__dirname, "../../../locales");
        this.loadAllLocales();
        this.validateAllLocales();
    }

    public static getInstance = (): LocalizationManager => {
        if (!LocalizationManager.instance) LocalizationManager.instance = new LocalizationManager();
        return LocalizationManager.instance;
    };

    private loadAllLocales = (): void => {
        if (!fs.existsSync(this.localesPath)) {
            fs.mkdirSync(this.localesPath, { recursive: true });
            return;
        }
        const files = fs.readdirSync(this.localesPath).filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
        if (files.length === 0) return;
        for (const file of files) {
            const locale = path.basename(file, path.extname(file));
            this.loadLocale(locale);
        }
    };

    private loadLocale = (locale: string): void => {
        const yamlPath = path.join(this.localesPath, `${locale}.yaml`);
        const ymlPath = path.join(this.localesPath, `${locale}.yml`);
        const filePath = fs.existsSync(ymlPath) ? ymlPath : yamlPath;

        if (!fs.existsSync(filePath)) return;

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = yaml.parse(content);

            if (!data || typeof data !== 'object') throw new Error(`Invalid locale data in ${locale}: data is not an object`);
            this.locales.set(locale, data);
        } catch (error) {
            throw new Error(`[LOCALIZATION] Failed to load locale '${locale}': ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    private validateAllLocales = (): void => {
        const englishLocale = this.locales.get(this.defaultLocale);
        if (!englishLocale) throw new Error(`[LOCALIZATION] Default locale '${this.defaultLocale}' not found`);

        const englishKeys = this.getAllKeys(englishLocale);

        for (const [locale, data] of this.locales) {
            if (locale === this.defaultLocale) continue;

            const localeKeys = this.getAllKeys(data);
            const missingKeys = englishKeys.filter(key => !localeKeys.includes(key));
            const extraKeys = localeKeys.filter(key => !englishKeys.includes(key));

            if (missingKeys.length > 0 || extraKeys.length > 0) {
                const errors: string[] = [];
                if (missingKeys.length > 0) errors.push(`Missing keys: ${missingKeys.join(', ')}`);
                if (extraKeys.length > 0) errors.push(`Extra keys: ${extraKeys.join(', ')}`);
                this.validationErrors.set(locale, errors);
            }
        }
    };

    private getAllKeys = (obj: Record<string, any>, prefix: string = ''): string[] => {
        const keys: string[] = [];

        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                keys.push(...this.getAllKeys(value, fullKey));
            } else {
                keys.push(fullKey);
            }
        }

        return keys;
    };

    public reloadLocales = (): void => {
        this.locales.clear();
        this.validationErrors.clear();
        this.loadAllLocales();
        this.validateAllLocales();
    };

    public getSupportedLocales = (): string[] => {
        return Array.from(this.locales.keys());
    };

    public isLocaleSupported = (locale: string): boolean => {
        return this.locales.has(locale);
    };

    public getValidationErrors = (locale?: string): Map<string, string[]> | string[] => {
        if (locale) return this.validationErrors.get(locale) || [];
        return this.validationErrors;
    };

    private getNestedValue = (obj: Record<string, any>, path: string): any => {
        try {
            return path.split('.').reduce((current, key) => {
                return current && current[key] !== undefined ? current[key] : null;
            }, obj);
        } catch (error) {
            return null;
        }
    };

    private interpolate = (text: string, data: InterpolationData = {}): string => {
        if (typeof text !== 'string') return String(text || '');

        try {
            return text.replace(/\{(\w+)\}/g, (match, key) => {
                const value = data[key];
                return value !== undefined ? String(value) : match;
            });
        } catch (error) {
            return text;
        }
    };

    public translate = (key: string, locale: string = this.defaultLocale, data: InterpolationData = {}): string => {
        if (!key) return '';

        let localeData = this.locales.get(locale);
        let translation = localeData ? this.getNestedValue(localeData, key) : null;

        if (!translation && locale !== this.defaultLocale) {
            localeData = this.locales.get(this.defaultLocale);
            translation = localeData ? this.getNestedValue(localeData, key) : null;
        }

        if (!translation) return key;
        return this.interpolate(translation, data);
    };

    public getCommandLocalizations = (key: string): discord.LocalizationMap => {
        const localizations: discord.LocalizationMap = {};

        for (const [locale, data] of this.locales) {
            if (locale === this.defaultLocale) continue;
            const translation = this.getNestedValue(data, key);
            if (translation && typeof translation === 'string') {
                const discordLocale = this.mapToDiscordLocale(locale);
                if (discordLocale) localizations[discordLocale] = translation;
            }
        }

        return localizations;
    };

    private mapToDiscordLocale = (locale: string): discord.Locale | null => {
        const mapping: Record<string, discord.Locale> = {
            'en': discord.Locale.EnglishUS,
            'es': discord.Locale.SpanishES,
            'fr': discord.Locale.French,
            'de': discord.Locale.German,
            'pt': discord.Locale.PortugueseBR,
            'ja': discord.Locale.Japanese,
            'ko': discord.Locale.Korean,
            'zh': discord.Locale.ChineseCN,
            'ru': discord.Locale.Russian,
            'it': discord.Locale.Italian,
            'nl': discord.Locale.Dutch,
            'pl': discord.Locale.Polish,
            'tr': discord.Locale.Turkish,
            'sv': discord.Locale.Swedish,
            'no': discord.Locale.Norwegian,
            'da': discord.Locale.Danish,
            'fi': discord.Locale.Finnish,
            'cs': discord.Locale.Czech,
            'bg': discord.Locale.Bulgarian,
            'uk': discord.Locale.Ukrainian,
            'hr': discord.Locale.Croatian,
            'ro': discord.Locale.Romanian,
            'lt': discord.Locale.Lithuanian,
            'el': discord.Locale.Greek,
            'hu': discord.Locale.Hungarian,
            'th': discord.Locale.Thai,
            'vi': discord.Locale.Vietnamese,
            'hi': discord.Locale.Hindi,
            'id': discord.Locale.Indonesian,
        };

        return mapping[locale] || null;
    };

    public mapDiscordLocaleToOurs = (discordLocale: string): string => {
        const mapping: Record<string, string> = {
            [discord.Locale.EnglishUS]: 'en',
            [discord.Locale.EnglishGB]: 'en',
            [discord.Locale.SpanishES]: 'es',
            [discord.Locale.French]: 'fr',
            [discord.Locale.German]: 'de',
            [discord.Locale.PortugueseBR]: 'pt',
            [discord.Locale.Japanese]: 'ja',
            [discord.Locale.Korean]: 'ko',
            [discord.Locale.ChineseCN]: 'zh',
            [discord.Locale.Russian]: 'ru',
            [discord.Locale.Italian]: 'it',
            [discord.Locale.Dutch]: 'nl',
            [discord.Locale.Polish]: 'pl',
            [discord.Locale.Turkish]: 'tr',
            [discord.Locale.Swedish]: 'sv',
            [discord.Locale.Norwegian]: 'no',
            [discord.Locale.Danish]: 'da',
            [discord.Locale.Finnish]: 'fi',
            [discord.Locale.Czech]: 'cs',
            [discord.Locale.Bulgarian]: 'bg',
            [discord.Locale.Ukrainian]: 'uk',
            [discord.Locale.Croatian]: 'hr',
            [discord.Locale.Romanian]: 'ro',
            [discord.Locale.Lithuanian]: 'lt',
            [discord.Locale.Greek]: 'el',
            [discord.Locale.Hungarian]: 'hu',
            [discord.Locale.Thai]: 'th',
            [discord.Locale.Vietnamese]: 'vi',
            [discord.Locale.Hindi]: 'hi',
            [discord.Locale.Indonesian]: 'id',
        };

        return mapping[discordLocale] || this.defaultLocale;
    };

    public validateLocaleCompleteness = (locale: string): { missingKeys: string[]; extraKeys: string[]; isComplete: boolean } => {
        const englishLocale = this.locales.get(this.defaultLocale);
        const targetLocale = this.locales.get(locale);

        if (!englishLocale || !targetLocale) return { missingKeys: [], extraKeys: [], isComplete: false };

        const englishKeys = this.getAllKeys(englishLocale);
        const targetKeys = this.getAllKeys(targetLocale);
        const missingKeys = englishKeys.filter(key => !targetKeys.includes(key));
        const extraKeys = targetKeys.filter(key => !englishKeys.includes(key));

        return { missingKeys, extraKeys, isComplete: missingKeys.length === 0 && extraKeys.length === 0 };
    };

    public getLocaleStats = (): Record<string, { totalKeys: number; missingKeys: number; completeness: number }> => {
        const stats: Record<string, { totalKeys: number; missingKeys: number; completeness: number }> = {};
        const englishLocale = this.locales.get(this.defaultLocale);

        if (!englishLocale) return stats;

        const totalEnglishKeys = this.getAllKeys(englishLocale).length;

        for (const [locale, data] of this.locales) {
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
}