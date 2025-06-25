import discord from 'discord.js';

import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { Command, CommandCategory, COMMAND_CATEGORY_MAP } from '../types';

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

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
		const focused = interaction.options.getFocused(true);

		if (focused.name === 'command') {
			const commands = Array.from(client.commands.values());
			const query = focused.value.toLowerCase();
			const filtered = commands
				.filter((cmd) => cmd.data.name.toLowerCase().includes(query))
				.slice(0, 25)
				.map((cmd) => ({ name: `/${cmd.data.name} - ${cmd.data.description}`, value: cmd.data.name }));
			await interaction.respond(filtered);
		}
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<discord.InteractionResponse<boolean> | void> => {
		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);

		const specificCommand = interaction.options.getString('command');

		if (specificCommand) {
			const command = client.commands.get(specificCommand);
			if (!command) {
				const embed = responseHandler.createErrorEmbed(t('responses.help.command_not_found', { command: specificCommand }), locale);
				return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
			}

			const commandEmbed = new discord.EmbedBuilder()
				.setColor('#5865f2')
				.setTitle(`📖 /${command.data.name}`)
				.setDescription(command.data.description)
				.addFields([
					{ name: t('responses.help.cooldown'), value: command.cooldown ? `${command.cooldown}s` : t('responses.help.no_cooldown'), inline: true },
					{ name: t('responses.help.permissions'), value: command.owner ? t('responses.help.owner_only') : command.userPerms ? command.userPerms.join(', ') : t('responses.help.none'), inline: true },
				])
				.setFooter({ text: t('responses.help.command_footer'), iconURL: client.user?.displayAvatarURL() })
				.setTimestamp();

			if (command.category) {
				const categoryInfo = COMMAND_CATEGORY_MAP[command.category];
				const categoryName = t(`responses.help.categories.${command.category}`) !== `responses.help.categories.${command.category}` ? t(`responses.help.categories.${command.category}`) : categoryInfo.name;
				commandEmbed.addFields([{ name: t('responses.help.category'), value: `${categoryInfo.emoji} ${categoryName}`, inline: true }]);
			}

			const apiData = command.data.toJSON();
			if (apiData.options && apiData.options.length > 0) {
				const optionsText = apiData.options.map((option) => `\`${option.name}\` - ${option.description}`).join('\n');
				commandEmbed.addFields([{ name: t('responses.help.options'), value: optionsText.length > 1024 ? optionsText.substring(0, 1021) + '...' : optionsText, inline: false }]);
			}
			return await interaction.reply({ embeds: [commandEmbed] });
		}

		const commands = Array.from(client.commands.values());
		const categorizedCommands = categorizeCommandsByCategory(commands);

		const embed = new discord.EmbedBuilder()
			.setColor('#5865f2')
			.setTitle(t('responses.help.title'))
			.setDescription(t('responses.help.description', { total: commands.length, prefix: '/' }))
			.setThumbnail(client.user?.displayAvatarURL() || '')
			.setFooter({ text: t('responses.help.footer'), iconURL: client.user?.displayAvatarURL() })
			.setTimestamp();

		const categoryOrder = [CommandCategory.MUSIC, CommandCategory.UTILITY, CommandCategory.OTHER];

		categoryOrder.forEach((category) => {
			const categoryCommands = categorizedCommands[category];
			if (categoryCommands && categoryCommands.length > 0) {
				const categoryInfo = COMMAND_CATEGORY_MAP[category];
				const categoryName = t(`responses.help.categories.${category}`) !== `responses.help.categories.${category}` ? t(`responses.help.categories.${category}`) : categoryInfo.name;
				const commandList = formatCommands(categoryCommands, t);
				embed.addFields([{ name: `${categoryInfo.emoji} ${categoryName} (${categoryCommands.length})`, value: commandList, inline: false }]);
			}
		});

		Object.keys(categorizedCommands).forEach((categoryKey) => {
			if (!categoryOrder.includes(categoryKey as CommandCategory)) {
				const categoryCommands = categorizedCommands[categoryKey as CommandCategory];
				if (categoryCommands && categoryCommands.length > 0) {
					const categoryName = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
					const commandList = formatCommands(categoryCommands, t);
					embed.addFields([{ name: `📋 ${categoryName} (${categoryCommands.length})`, value: commandList, inline: false }]);
				}
			}
		});

		const supportButton = responseHandler.getSupportButton(locale);
		await interaction.reply({ embeds: [embed], components: [supportButton] });
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

const formatCommands = (cmds: Command[], t: (key: string, data?: Record<string, any>) => string): string => {
	if (cmds.length === 0) return t('responses.help.no_commands');
	return cmds.map((cmd) => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
};

export default helpCommand;
