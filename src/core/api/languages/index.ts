import express from 'express';
import discord from 'discord.js';

import { LanguageApiEntry, LanguageApiPayload } from '../../../types';
import { LocaleDetector, LocalizationManager } from '../../locales';

const LOCALE_CODE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/;

const ENGLISH_NAMES: Record<string, string> = {
	en: 'English',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
	pt: 'Portuguese',
	ja: 'Japanese',
	ko: 'Korean',
	zh: 'Chinese',
	ru: 'Russian',
	it: 'Italian',
	nl: 'Dutch',
	pl: 'Polish',
	tr: 'Turkish',
	sv: 'Swedish',
	no: 'Norwegian',
	da: 'Danish',
	fi: 'Finnish',
	cs: 'Czech',
	bg: 'Bulgarian',
	uk: 'Ukrainian',
	hr: 'Croatian',
	ro: 'Romanian',
	lt: 'Lithuanian',
	el: 'Greek',
	hu: 'Hungarian',
	th: 'Thai',
	vi: 'Vietnamese',
	hi: 'Hindi',
	id: 'Indonesian',
};

export default class LanguagesAPIHandler {
	private client: discord.Client;
	private router: express.Router;
	private detector: LocaleDetector;
	private localization: LocalizationManager;

	constructor(client: discord.Client) {
		this.client = client;
		this.router = express.Router();
		this.detector = new LocaleDetector();
		this.localization = LocalizationManager.getInstance();
		this.router.use(this.publicHeaders);
		this.setupRoutes();
	}

	private setupRoutes = (): void => {
		this.router.get('/', this.handleList);
		this.router.get('/:code', this.handleLanguage);
		this.router.use((_req: express.Request, res: express.Response) => res.status(404).json({ success: false, error: 'Unknown languages endpoint' }));
	};

	private publicHeaders = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
		res.setHeader('Cache-Control', 'public, max-age=300');
		if (req.method === 'OPTIONS') {
			res.sendStatus(204);
			return;
		}
		next();
	};

	private send = (res: express.Response, data: unknown): void => {
		res.status(200).json({ success: true, generatedAt: new Date().toISOString(), data });
	};

	private fail = (res: express.Response, error: unknown, context: string): void => {
		this.client.logger.error(`[LANGUAGES_API] ${context}: ${error}`);
		res.status(503).json({ success: false, error: 'Failed to resolve supported languages' });
	};

	private buildEntries = (): LanguageApiEntry[] => {
		const stats = this.localization.getLocaleStats();
		const defaultLocale = this.localization.getDefaultLocale();

		return this.detector
			.getSupportedLanguages()
			.map((language) => {
				const stat = stats[language.code];
				return {
					code: language.code,
					name: ENGLISH_NAMES[language.code] ?? language.name,
					nativeName: language.name,
					discordLocale: this.localization.mapToDiscordLocale(language.code),
					default: language.code === defaultLocale,
					completeness: stat?.completeness ?? 0,
					totalKeys: stat?.totalKeys ?? 0,
					missingKeys: stat?.missingKeys ?? 0,
				};
			})
			.sort((a, b) => (a.default === b.default ? a.name.localeCompare(b.name) : a.default ? -1 : 1));
	};

	private buildPayload = (): LanguageApiPayload => {
		const languages = this.buildEntries();
		return { default: this.localization.getDefaultLocale(), total: languages.length, languages };
	};

	private handleList = async (_req: express.Request, res: express.Response): Promise<void> => {
		try {
			this.send(res, this.buildPayload());
		} catch (error) {
			this.fail(res, error, 'list');
		}
	};

	private handleLanguage = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			const requested = String(req.params.code);
			if (!LOCALE_CODE.test(requested)) {
				res.status(400).json({ success: false, error: 'Invalid language code' });
				return;
			}
			const code = this.localization.isLocaleSupported(requested) ? requested : requested.split('-')[0].toLowerCase();
			const language = this.buildEntries().find((entry) => entry.code === code);
			if (!language) {
				res.status(404).json({ success: false, error: 'Language not supported' });
				return;
			}
			this.send(res, language);
		} catch (error) {
			this.fail(res, error, 'language');
		}
	};

	getRouter = (): express.Router => {
		return this.router;
	};
}
