import discord from 'discord.js';

import { AutoComplete } from '../core/commands';
import { MusicResponseHandler } from '../core/music';
import { Command, CommandCategory, COMMAND_CATEGORY_MAP } from '../types';
import { LocalizationManager, LocaleDetector, TranslatorFunction } from '../core/locales';
import { v2, v2Ephemeral, withRows, subtext, panel, fields } from '../utils/v2';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const helpCommand: Command = {
	cooldown: 10,
	category: CommandCategory.UTILITY,
	data: new discord.SlashCommandBuilder()
		.setName('help')
		.setDescription('Display all available commands and their descriptions')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.description'))
		.addStringOption((option) => option.setName('command').setDescription('Get detailed information about a specific command').setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.description')).setRequired(false).setAutocomplete(true)),
	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		const autoComplete = new AutoComplete(client, interaction);
		await autoComplete.helpAutocomplete();
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<discord.InteractionResponse<boolean> | void> => {
		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);

		const specificCommand = interaction.options.getString('command');

		if (specificCommand) {
			const command = client.commands.get(specificCommand);
			if (!command) {
				const container = responseHandler.createErrorContainer(t('responses.help.command_not_found', { command: specificCommand }), locale);
				return await interaction.reply(v2Ephemeral(container));
			}

			const categoryInfo = command.category ? COMMAND_CATEGORY_MAP[command.category] : null;
			const categoryName = command.category ? (t(`responses.help.categories.${command.category}`) !== `responses.help.categories.${command.category}` ? t(`responses.help.categories.${command.category}`) : categoryInfo!.name) : null;

			const details = fields([
				[t('responses.help.cooldown'), command.cooldown ? `${command.cooldown}s` : t('responses.help.no_cooldown')],
				[t('responses.help.permissions'), command.owner ? t('responses.help.owner_only') : command.userPerms ? command.userPerms.join(', ') : t('responses.help.none')],
				categoryInfo && categoryName ? [t('responses.help.category'), `${categoryInfo.emoji} ${categoryName}`] : null,
			]);

			const apiData = command.data.toJSON();
			const optionsText = apiData.options?.length ? apiData.options.map((option) => `\`${option.name}\` - ${option.description}`).join('\n') : '';

			const commandContainer = panel(0x5865f2, {
				title: `📖 /${command.data.name}`,
				body: [command.data.description, details, optionsText ? `**${t('responses.help.options')}**\n${optionsText}` : ''].filter(Boolean).join('\n\n'),
				footer: t('responses.help.command_footer'),
				timestamp: true,
			});
			return await interaction.reply(v2(commandContainer));
		}

		const commands = Array.from(client.commands.values());
		const categorizedCommands = categorizeCommandsByCategory(commands);

		const container = panel(0x5865f2, {
			title: t('responses.help.title'),
			body: t('responses.help.description', { total: commands.length, prefix: '/' }),
			thumbnail: client.user?.displayAvatarURL() || null,
		});

		const categoryOrder = [CommandCategory.MUSIC, CommandCategory.UTILITY, CommandCategory.OTHER];
		const sections: string[] = [];

		categoryOrder.forEach((category) => {
			const categoryCommands = categorizedCommands[category];
			if (categoryCommands && categoryCommands.length > 0) {
				const categoryInfo = COMMAND_CATEGORY_MAP[category];
				const categoryName = t(`responses.help.categories.${category}`) !== `responses.help.categories.${category}` ? t(`responses.help.categories.${category}`) : categoryInfo.name;
				sections.push(`**${categoryInfo.emoji} ${categoryName} (${categoryCommands.length})**\n${formatCommands(categoryCommands, t)}`);
			}
		});

		Object.keys(categorizedCommands).forEach((categoryKey) => {
			if (!categoryOrder.includes(categoryKey as CommandCategory)) {
				const categoryCommands = categorizedCommands[categoryKey as CommandCategory];
				if (categoryCommands && categoryCommands.length > 0) {
					const categoryName = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
					sections.push(`**📋 ${categoryName} (${categoryCommands.length})**\n${formatCommands(categoryCommands, t)}`);
				}
			}
		});

		container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(sections.join('\n\n')));
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(subtext(t('responses.help.footer'))));

		await interaction.reply(v2(withRows(container, responseHandler.getSupportButton(locale))));
	},
};

const categorizeCommandsByCategory = (commands: Command[]): Record<CommandCategory, Command[]> => {
	const categories: Record<CommandCategory, Command[]> = {
		[CommandCategory.MUSIC]: [],
		[CommandCategory.UTILITY]: [],
		[CommandCategory.OTHER]: [],
	};

	commands.forEach((cmd) => {
		const category = cmd.category || CommandCategory.OTHER;
		if (!categories[category]) categories[category] = [];
		categories[category].push(cmd);
	});

	return categories;
};

const formatCommands = (cmds: Command[], t: TranslatorFunction): string => {
	if (cmds.length === 0) return t('responses.help.no_commands');
	return cmds.map((cmd) => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
};

export default helpCommand;
