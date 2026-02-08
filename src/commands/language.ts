import discord from 'discord.js';

import { AutoComplete } from '../core/commands';
import { Command, CommandCategory } from '../types';
import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const langCommand: Command = {
	cooldown: 3600,
	category: CommandCategory.UTILITY,
	data: new discord.SlashCommandBuilder()
		.setName('language')
		.setDescription('Set language preferences for the bot')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.language.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.language.description'))
		.addStringOption((option) =>
			option
				.setName('scope')
				.setDescription('Set language for user or server')
				.setNameLocalizations(localizationManager.getCommandLocalizations('commands.language.options.scope.name'))
				.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.language.options.scope.description'))
				.setRequired(true)
				.addChoices({ name: 'User', value: 'user', name_localizations: localizationManager.getCommandLocalizations('commands.language.options.scope.choices.user') }, { name: 'Server', value: 'server', name_localizations: localizationManager.getCommandLocalizations('commands.language.options.scope.choices.server') }, { name: 'Reset', value: 'reset', name_localizations: localizationManager.getCommandLocalizations('commands.language.options.scope.choices.reset') }),
		)
		.addStringOption((option) => option.setName('language').setDescription('Choose your preferred language').setNameLocalizations(localizationManager.getCommandLocalizations('commands.language.options.language.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.language.options.language.description')).setRequired(false).setAutocomplete(true)),
	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		const autoComplete = new AutoComplete(client, interaction);
		await autoComplete.languageAutocomplete();
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<discord.InteractionResponse<boolean> | void> => {
		const t = await localeDetector.getTranslator(interaction);
		const responseHandler = new MusicResponseHandler(client);
		const currentLocale = await localeDetector.detectLocale(interaction);

		const scope = interaction.options.getString('scope', true);
		const language = interaction.options.getString('language');

		try {
			if (scope === 'reset') {
				if (interaction.inGuild()) {
					await localeDetector.setUserLanguage(interaction.user.id, null);
					if (interaction.memberPermissions?.has(discord.PermissionsBitField.Flags.ManageGuild)) await localeDetector.setGuildLanguage(interaction.guildId!, null);
				} else {
					await localeDetector.setUserLanguage(interaction.user.id, null);
				}

				const embed = responseHandler.createSuccessEmbed(t('responses.language.reset'));
				await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				return;
			}

			if (!language) {
				const embed = responseHandler.createErrorEmbed('Please provide a language when not using reset option.', currentLocale);
				return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
			}

			if (!localeDetector.isLanguageSupported(language)) {
				const supportedLanguages = localeDetector.getSupportedLanguages();
				const languageList = supportedLanguages.map((lang) => `${lang.name} (${lang.code})`).join(', ');
				const embed = responseHandler.createErrorEmbed(t('responses.language.unsupported', { language, languages: languageList }), currentLocale);
				return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
			}

			if (scope === 'user') {
				const currentUserLang = await localeDetector.getUserLanguage(interaction.user.id);
				if (currentUserLang === language) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const embed = responseHandler.createInfoEmbed(t('responses.language.same_language', { language: languageName }));
					return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}

				const success = await localeDetector.setUserLanguage(interaction.user.id, language);
				if (success) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const embed = responseHandler.createSuccessEmbed(localizationManager.translate('responses.language.user_set', language, { language: languageName }));
					await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				} else {
					const embed = responseHandler.createErrorEmbed('Failed to set user language preference.', currentLocale);
					await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}
			} else if (scope === 'server') {
				if (!interaction.inGuild()) {
					const embed = responseHandler.createErrorEmbed(t('responses.errors.server_only'), currentLocale);
					return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}

				if (!interaction.memberPermissions?.has(discord.PermissionsBitField.Flags.ManageGuild)) {
					const embed = responseHandler.createErrorEmbed(t('responses.language.no_permission'), currentLocale);
					return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}

				const currentGuildLang = await localeDetector.getGuildLanguage(interaction.guildId!);
				if (currentGuildLang === language) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const embed = responseHandler.createInfoEmbed(t('responses.language.same_language', { language: languageName }));
					return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}

				const success = await localeDetector.setGuildLanguage(interaction.guildId!, language);
				if (success) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const embed = responseHandler.createSuccessEmbed(localizationManager.translate('responses.language.server_set', language, { language: languageName }));
					await interaction.reply({ embeds: [embed] });
				} else {
					const embed = responseHandler.createErrorEmbed('Failed to set server language preference.', currentLocale);
					await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}
			}
		} catch (error) {
			client.logger.error(`[LANGUAGE_COMMAND] Error: ${error}`);
			const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), currentLocale, true);
			if (!interaction.replied) {
				await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
			} else {
				await interaction.followUp({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
			}
		}
	},
};

export default langCommand;
