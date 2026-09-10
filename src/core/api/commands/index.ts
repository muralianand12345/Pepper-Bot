import express from 'express';
import discord from 'discord.js';

import { LocalizationManager } from '../../locales';
import { Command, CommandApiCategory, CommandApiEntry, CommandApiOption, CommandApiPayload, CommandApiSubcommand, CommandCategory, COMMAND_CATEGORY_MAP } from '../../../types';

const CATEGORY_ORDER: CommandCategory[] = [CommandCategory.MUSIC, CommandCategory.UTILITY, CommandCategory.OTHER];
const COMMAND_NAME = /^[\w-]{1,32}$/;

export default class CommandsAPIHandler {
	private client: discord.Client;
	private router: express.Router;
	private localization: LocalizationManager;

	constructor(client: discord.Client) {
		this.client = client;
		this.router = express.Router();
		this.localization = LocalizationManager.getInstance();
		this.router.use(this.publicHeaders);
		this.setupRoutes();
	}

	private setupRoutes = (): void => {
		this.router.get('/', this.handleList);
		this.router.get('/:name', this.handleCommand);
		this.router.use((_req: express.Request, res: express.Response) => res.status(404).json({ success: false, error: 'Unknown commands endpoint' }));
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
		this.client.logger.error(`[COMMANDS_API] ${context}: ${error}`);
		res.status(503).json({ success: false, error: 'Failed to build command catalogue' });
	};

	private resolveLocale = (value: unknown): string => {
		const requested = typeof value === 'string' ? value.trim() : '';
		const fallback = this.localization.getDefaultLocale();
		if (!requested) return fallback;
		if (this.localization.isLocaleSupported(requested)) return requested;
		const base = requested.split('-')[0].toLowerCase();
		return this.localization.isLocaleSupported(base) ? base : fallback;
	};

	private localize = (fallback: string, localizations: discord.LocalizationMap | null | undefined, discordLocale: discord.Locale | null): string => {
		if (!discordLocale || !localizations) return fallback;
		return localizations[discordLocale] || fallback;
	};

	private categoryInfo = (category: CommandCategory, locale: string): { name: string; emoji: string } => {
		const info = COMMAND_CATEGORY_MAP[category] || COMMAND_CATEGORY_MAP[CommandCategory.OTHER];
		const key = `responses.help.categories.${category}`;
		const translated = this.localization.translate(key, locale);
		return { name: translated === key ? info.name : translated, emoji: info.emoji };
	};

	private permissionNames = (permissions?: Array<discord.PermissionResolvable>): string[] => {
		if (!permissions?.length) return [];
		try {
			return new discord.PermissionsBitField(permissions).toArray();
		} catch (error) {
			this.client.logger.warn(`[COMMANDS_API] Failed to resolve permissions: ${error}`);
			return permissions.map((permission) => String(permission));
		}
	};

	private buildOption = (option: discord.APIApplicationCommandOption, discordLocale: discord.Locale | null): CommandApiOption => {
		const choices = 'choices' in option && Array.isArray(option.choices) ? option.choices.map((choice) => ({ name: this.localize(choice.name, choice.name_localizations, discordLocale), value: choice.value })) : [];
		return {
			name: this.localize(option.name, option.name_localizations, discordLocale),
			description: this.localize(option.description, option.description_localizations, discordLocale),
			type: option.type,
			typeName: discord.ApplicationCommandOptionType[option.type] ?? 'Unknown',
			required: 'required' in option ? !!option.required : false,
			autocomplete: 'autocomplete' in option ? !!option.autocomplete : false,
			choices,
		};
	};

	private buildEntry = (command: Command, locale: string, discordLocale: discord.Locale | null): CommandApiEntry => {
		const data = command.data.toJSON();
		const category = command.category || CommandCategory.OTHER;
		const { name: categoryName, emoji: categoryEmoji } = this.categoryInfo(category, locale);

		const options: CommandApiOption[] = [];
		const subcommands: CommandApiSubcommand[] = [];

		for (const option of data.options ?? []) {
			if (option.type === discord.ApplicationCommandOptionType.Subcommand) {
				subcommands.push({ name: this.localize(option.name, option.name_localizations, discordLocale), description: this.localize(option.description, option.description_localizations, discordLocale), group: null, options: (option.options ?? []).map((child) => this.buildOption(child, discordLocale)) });
				continue;
			}
			if (option.type === discord.ApplicationCommandOptionType.SubcommandGroup) {
				const group = this.localize(option.name, option.name_localizations, discordLocale);
				for (const child of option.options ?? []) subcommands.push({ name: this.localize(child.name, child.name_localizations, discordLocale), description: this.localize(child.description, child.description_localizations, discordLocale), group, options: (child.options ?? []).map((grandchild) => this.buildOption(grandchild, discordLocale)) });
				continue;
			}
			options.push(this.buildOption(option, discordLocale));
		}

		return {
			name: this.localize(data.name, data.name_localizations, discordLocale),
			description: this.localize(data.description, data.description_localizations, discordLocale),
			category,
			categoryName,
			categoryEmoji,
			cooldown: command.cooldown ?? 0,
			dj: !!command.dj,
			premium: !!command.premium,
			ownerOnly: !!command.owner,
			userPermissions: this.permissionNames(command.userPerms),
			botPermissions: this.permissionNames(command.botPerms),
			options,
			subcommands,
		};
	};

	private buildCategories = (entries: CommandApiEntry[], locale: string): CommandApiCategory[] => {
		const counts = entries.reduce<Map<CommandCategory, number>>((acc, entry) => acc.set(entry.category, (acc.get(entry.category) ?? 0) + 1), new Map());
		const ordered = [...CATEGORY_ORDER.filter((category) => counts.has(category)), ...[...counts.keys()].filter((category) => !CATEGORY_ORDER.includes(category))];
		return ordered.map((category) => {
			const { name, emoji } = this.categoryInfo(category, locale);
			return { id: category, name, emoji, count: counts.get(category) ?? 0 };
		});
	};

	private buildPayload = (locale: string): CommandApiPayload => {
		const discordLocale = locale === this.localization.getDefaultLocale() ? null : this.localization.mapToDiscordLocale(locale);
		const commands = [...this.client.commands.values()].sort((a, b) => {
			const rank = CATEGORY_ORDER.indexOf(a.category || CommandCategory.OTHER) - CATEGORY_ORDER.indexOf(b.category || CommandCategory.OTHER);
			return rank !== 0 ? rank : a.data.name.localeCompare(b.data.name);
		});
		const entries = commands.map((command) => this.buildEntry(command, locale, discordLocale));
		return { locale, total: entries.length, categories: this.buildCategories(entries, locale), commands: entries };
	};

	private handleList = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			if (!this.client.commands.size) {
				res.status(503).json({ success: false, error: 'Commands are not loaded yet' });
				return;
			}
			this.send(res, this.buildPayload(this.resolveLocale(req.query.locale)));
		} catch (error) {
			this.fail(res, error, 'list');
		}
	};

	private handleCommand = async (req: express.Request, res: express.Response): Promise<void> => {
		try {
			const name = String(req.params.name).toLowerCase();
			if (!COMMAND_NAME.test(name)) {
				res.status(400).json({ success: false, error: 'Invalid command name' });
				return;
			}
			const command = this.client.commands.get(name);
			if (!command) {
				res.status(404).json({ success: false, error: 'Command not found' });
				return;
			}
			const locale = this.resolveLocale(req.query.locale);
			const discordLocale = locale === this.localization.getDefaultLocale() ? null : this.localization.mapToDiscordLocale(locale);
			this.send(res, { locale, command: this.buildEntry(command, locale, discordLocale) });
		} catch (error) {
			this.fail(res, error, 'command');
		}
	};

	getRouter = (): express.Router => {
		return this.router;
	};
}
