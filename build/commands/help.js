"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const commands_1 = require("../core/commands");
const music_1 = require("../core/music");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const v2_1 = require("../utils/v2");
const localeDetector = new locales_1.LocaleDetector();
const localizationManager = locales_1.LocalizationManager.getInstance();
const helpCommand = {
    cooldown: 10,
    category: types_1.CommandCategory.UTILITY,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all available commands and their descriptions')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.description'))
        .addStringOption((option) => option.setName('command').setDescription('Get detailed information about a specific command').setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.description')).setRequired(false).setAutocomplete(true)),
    autocomplete: async (interaction, client) => {
        const autoComplete = new commands_1.AutoComplete(client, interaction);
        await autoComplete.helpAutocomplete();
    },
    execute: async (interaction, client) => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_1.MusicResponseHandler(client);
        const specificCommand = interaction.options.getString('command');
        if (specificCommand) {
            const command = client.commands.get(specificCommand);
            if (!command) {
                const container = responseHandler.createErrorContainer(t('responses.help.command_not_found', { command: specificCommand }), locale);
                return await interaction.reply((0, v2_1.v2Ephemeral)(container));
            }
            const categoryInfo = command.category ? types_1.COMMAND_CATEGORY_MAP[command.category] : null;
            const categoryName = command.category ? (t(`responses.help.categories.${command.category}`) !== `responses.help.categories.${command.category}` ? t(`responses.help.categories.${command.category}`) : categoryInfo.name) : null;
            const details = (0, v2_1.fields)([
                [t('responses.help.cooldown'), command.cooldown ? `${command.cooldown}s` : t('responses.help.no_cooldown')],
                [t('responses.help.permissions'), command.owner ? t('responses.help.owner_only') : command.userPerms ? command.userPerms.join(', ') : t('responses.help.none')],
                categoryInfo && categoryName ? [t('responses.help.category'), `${categoryInfo.emoji} ${categoryName}`] : null,
            ]);
            const apiData = command.data.toJSON();
            const optionsText = apiData.options?.length ? apiData.options.map((option) => `\`${option.name}\` - ${option.description}`).join('\n') : '';
            const commandContainer = (0, v2_1.panel)(0x5865f2, {
                title: `📖 /${command.data.name}`,
                body: [command.data.description, details, optionsText ? `**${t('responses.help.options')}**\n${optionsText}` : ''].filter(Boolean).join('\n\n'),
                footer: t('responses.help.command_footer'),
                timestamp: true,
            });
            return await interaction.reply((0, v2_1.v2)(commandContainer));
        }
        const commands = Array.from(client.commands.values());
        const categorizedCommands = categorizeCommandsByCategory(commands);
        const container = (0, v2_1.panel)(0x5865f2, {
            title: t('responses.help.title'),
            body: t('responses.help.description', { total: commands.length, prefix: '/' }),
            thumbnail: client.user?.displayAvatarURL() || null,
        });
        const categoryOrder = [types_1.CommandCategory.MUSIC, types_1.CommandCategory.UTILITY, types_1.CommandCategory.OTHER];
        const sections = [];
        categoryOrder.forEach((category) => {
            const categoryCommands = categorizedCommands[category];
            if (categoryCommands && categoryCommands.length > 0) {
                const categoryInfo = types_1.COMMAND_CATEGORY_MAP[category];
                const categoryName = t(`responses.help.categories.${category}`) !== `responses.help.categories.${category}` ? t(`responses.help.categories.${category}`) : categoryInfo.name;
                sections.push(`**${categoryInfo.emoji} ${categoryName} (${categoryCommands.length})**\n${formatCommands(categoryCommands, t)}`);
            }
        });
        Object.keys(categorizedCommands).forEach((categoryKey) => {
            if (!categoryOrder.includes(categoryKey)) {
                const categoryCommands = categorizedCommands[categoryKey];
                if (categoryCommands && categoryCommands.length > 0) {
                    const categoryName = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
                    sections.push(`**📋 ${categoryName} (${categoryCommands.length})**\n${formatCommands(categoryCommands, t)}`);
                }
            }
        });
        container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(sections.join('\n\n')));
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent((0, v2_1.subtext)(t('responses.help.footer'))));
        await interaction.reply((0, v2_1.v2)((0, v2_1.withRows)(container, responseHandler.getSupportButton(locale))));
    },
};
const categorizeCommandsByCategory = (commands) => {
    const categories = {
        [types_1.CommandCategory.MUSIC]: [],
        [types_1.CommandCategory.UTILITY]: [],
        [types_1.CommandCategory.OTHER]: [],
    };
    commands.forEach((cmd) => {
        const category = cmd.category || types_1.CommandCategory.OTHER;
        if (!categories[category])
            categories[category] = [];
        categories[category].push(cmd);
    });
    return categories;
};
const formatCommands = (cmds, t) => {
    if (cmds.length === 0)
        return t('responses.help.no_commands');
    return cmds.map((cmd) => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
};
exports.default = helpCommand;
