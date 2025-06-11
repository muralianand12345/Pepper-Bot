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

    private constructor() {
        this.localesPath = path.join(__dirname, "../../../locales");
        this.loadAllLocales();
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

        for (const file of files) {
            const locale = path.basename(file, path.extname(file));
            this.loadLocale(locale);
        }
    };

    private loadLocale = (locale: string): void => {
        const filePath = path.join(this.localesPath, `${locale}.yml`);
        if (!fs.existsSync(filePath)) {
            const yamlPath = path.join(this.localesPath, `${locale}.yaml`);
            if (!fs.existsSync(yamlPath)) return;
            const content = fs.readFileSync(yamlPath, 'utf8');
            const data = yaml.parse(content);
            this.locales.set(locale, data);
            return;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const data = yaml.parse(content);
        this.locales.set(locale, data);
    };

    public reloadLocales = (): void => {
        this.locales.clear();
        this.loadAllLocales();
    };

    public getSupportedLocales = (): string[] => {
        return Array.from(this.locales.keys());
    };

    public isLocaleSupported = (locale: string): boolean => {
        return this.locales.has(locale);
    };

    private getNestedValue = (obj: Record<string, any>, path: string): any => {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    };

    private interpolate = (text: string, data: InterpolationData = {}): string => {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? String(data[key]) : match;
        });
    };

    public translate = (key: string, locale: string = this.defaultLocale, data: InterpolationData = {}): string => {
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
            if (translation) {
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
};