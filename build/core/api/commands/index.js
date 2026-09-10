"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const discord_js_1 = __importDefault(require("discord.js"));
const locales_1 = require("../../locales");
const types_1 = require("../../../types");
const CATEGORY_ORDER = [types_1.CommandCategory.MUSIC, types_1.CommandCategory.UTILITY, types_1.CommandCategory.OTHER];
const COMMAND_NAME = /^[\w-]{1,32}$/;
class CommandsAPIHandler {
    constructor(client) {
        this.setupRoutes = () => {
            this.router.get('/', this.handleList);
            this.router.get('/:name', this.handleCommand);
            this.router.use((_req, res) => res.status(404).json({ success: false, error: 'Unknown commands endpoint' }));
        };
        this.publicHeaders = (req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Cache-Control', 'public, max-age=300');
            if (req.method === 'OPTIONS') {
                res.sendStatus(204);
                return;
            }
            next();
        };
        this.send = (res, data) => {
            res.status(200).json({ success: true, generatedAt: new Date().toISOString(), data });
        };
        this.fail = (res, error, context) => {
            this.client.logger.error(`[COMMANDS_API] ${context}: ${error}`);
            res.status(503).json({ success: false, error: 'Failed to build command catalogue' });
        };
        this.resolveLocale = (value) => {
            const requested = typeof value === 'string' ? value.trim() : '';
            const fallback = this.localization.getDefaultLocale();
            if (!requested)
                return fallback;
            if (this.localization.isLocaleSupported(requested))
                return requested;
            const base = requested.split('-')[0].toLowerCase();
            return this.localization.isLocaleSupported(base) ? base : fallback;
        };
        this.localize = (fallback, localizations, discordLocale) => {
            if (!discordLocale || !localizations)
                return fallback;
            return localizations[discordLocale] || fallback;
        };
        this.categoryInfo = (category, locale) => {
            const info = types_1.COMMAND_CATEGORY_MAP[category] || types_1.COMMAND_CATEGORY_MAP[types_1.CommandCategory.OTHER];
            const key = `responses.help.categories.${category}`;
            const translated = this.localization.translate(key, locale);
            return { name: translated === key ? info.name : translated, emoji: info.emoji };
        };
        this.permissionNames = (permissions) => {
            if (!permissions?.length)
                return [];
            try {
                return new discord_js_1.default.PermissionsBitField(permissions).toArray();
            }
            catch (error) {
                this.client.logger.warn(`[COMMANDS_API] Failed to resolve permissions: ${error}`);
                return permissions.map((permission) => String(permission));
            }
        };
        this.buildOption = (option, discordLocale) => {
            const choices = 'choices' in option && Array.isArray(option.choices) ? option.choices.map((choice) => ({ name: this.localize(choice.name, choice.name_localizations, discordLocale), value: choice.value })) : [];
            return {
                name: this.localize(option.name, option.name_localizations, discordLocale),
                description: this.localize(option.description, option.description_localizations, discordLocale),
                type: option.type,
                typeName: discord_js_1.default.ApplicationCommandOptionType[option.type] ?? 'Unknown',
                required: 'required' in option ? !!option.required : false,
                autocomplete: 'autocomplete' in option ? !!option.autocomplete : false,
                choices,
            };
        };
        this.buildEntry = (command, locale, discordLocale) => {
            const data = command.data.toJSON();
            const category = command.category || types_1.CommandCategory.OTHER;
            const { name: categoryName, emoji: categoryEmoji } = this.categoryInfo(category, locale);
            const options = [];
            const subcommands = [];
            for (const option of data.options ?? []) {
                if (option.type === discord_js_1.default.ApplicationCommandOptionType.Subcommand) {
                    subcommands.push({ name: this.localize(option.name, option.name_localizations, discordLocale), description: this.localize(option.description, option.description_localizations, discordLocale), group: null, options: (option.options ?? []).map((child) => this.buildOption(child, discordLocale)) });
                    continue;
                }
                if (option.type === discord_js_1.default.ApplicationCommandOptionType.SubcommandGroup) {
                    const group = this.localize(option.name, option.name_localizations, discordLocale);
                    for (const child of option.options ?? [])
                        subcommands.push({ name: this.localize(child.name, child.name_localizations, discordLocale), description: this.localize(child.description, child.description_localizations, discordLocale), group, options: (child.options ?? []).map((grandchild) => this.buildOption(grandchild, discordLocale)) });
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
        this.buildCategories = (entries, locale) => {
            const counts = entries.reduce((acc, entry) => acc.set(entry.category, (acc.get(entry.category) ?? 0) + 1), new Map());
            const ordered = [...CATEGORY_ORDER.filter((category) => counts.has(category)), ...[...counts.keys()].filter((category) => !CATEGORY_ORDER.includes(category))];
            return ordered.map((category) => {
                const { name, emoji } = this.categoryInfo(category, locale);
                return { id: category, name, emoji, count: counts.get(category) ?? 0 };
            });
        };
        this.buildPayload = (locale) => {
            const discordLocale = locale === this.localization.getDefaultLocale() ? null : this.localization.mapToDiscordLocale(locale);
            const commands = [...this.client.commands.values()].sort((a, b) => {
                const rank = CATEGORY_ORDER.indexOf(a.category || types_1.CommandCategory.OTHER) - CATEGORY_ORDER.indexOf(b.category || types_1.CommandCategory.OTHER);
                return rank !== 0 ? rank : a.data.name.localeCompare(b.data.name);
            });
            const entries = commands.map((command) => this.buildEntry(command, locale, discordLocale));
            return { locale, total: entries.length, categories: this.buildCategories(entries, locale), commands: entries };
        };
        this.handleList = async (req, res) => {
            try {
                if (!this.client.commands.size) {
                    res.status(503).json({ success: false, error: 'Commands are not loaded yet' });
                    return;
                }
                this.send(res, this.buildPayload(this.resolveLocale(req.query.locale)));
            }
            catch (error) {
                this.fail(res, error, 'list');
            }
        };
        this.handleCommand = async (req, res) => {
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
            }
            catch (error) {
                this.fail(res, error, 'command');
            }
        };
        this.getRouter = () => {
            return this.router;
        };
        this.client = client;
        this.router = express_1.default.Router();
        this.localization = locales_1.LocalizationManager.getInstance();
        this.router.use(this.publicHeaders);
        this.setupRoutes();
    }
}
exports.default = CommandsAPIHandler;
