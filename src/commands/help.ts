import discord from 'discord.js';

import { Command, CommandCategory } from '../types';
import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';

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

			if (command.category && command.category.length > 0) {
				const categoryNames = command.category
					.map((cat) => {
						const categoryKey = `responses.help.categories.${cat}`;
						return t(categoryKey) !== categoryKey ? t(categoryKey) : cat.charAt(0).toUpperCase() + cat.slice(1);
					})
					.join(', ');
				commandEmbed.addFields([{ name: t('responses.help.category'), value: categoryNames, inline: true }]);
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

		const categoryOrder = ['music', 'utility', 'other'];
		const categoryEmojis = { music: '🎵', utility: '🔧', other: '📦' };

		categoryOrder.forEach((categoryKey) => {
			const categoryCommands = categorizedCommands[categoryKey];
			if (categoryCommands && categoryCommands.length > 0) {
				const categoryName = t(`responses.help.categories.${categoryKey}`);
				const emoji = categoryEmojis[categoryKey as keyof typeof categoryEmojis] || '📋';
				const commandList = formatCommands(categoryCommands, t);
				embed.addFields([{ name: `${emoji} ${categoryName} (${categoryCommands.length})`, value: commandList, inline: false }]);
			}
		});

		Object.keys(categorizedCommands).forEach((categoryKey) => {
			if (!categoryOrder.includes(categoryKey)) {
				const categoryCommands = categorizedCommands[categoryKey];
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

const categorizeCommandsByCategory = (commands: Command[]): Record<string, Command[]> => {
	const categories: Record<string, Command[]> = {};

	commands.forEach((cmd) => {
		if (cmd.category && cmd.category.length > 0) {
			cmd.category.forEach((cat) => {
				if (!categories[cat]) categories[cat] = [];
				categories[cat].push(cmd);
			});
		} else {
			if (!categories['other']) categories['other'] = [];
			categories['other'].push(cmd);
		}
	});

	return categories;
};

const formatCommands = (cmds: Command[], t: (key: string, data?: Record<string, any>) => string): string => {
	if (cmds.length === 0) return t('responses.help.no_commands');
	return cmds.map((cmd) => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
};

export default helpCommand;
