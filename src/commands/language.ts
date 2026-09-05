import discord from 'discord.js';

import { AutoComplete } from '../core/commands';
import { Command, CommandCategory } from '../types';
import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { v2, v2Ephemeral } from '../utils/v2';

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

				const container = responseHandler.createSuccessContainer(t('responses.language.reset'));
				await interaction.reply(v2Ephemeral(container));
				return;
			}

			if (!language) {
				const container = responseHandler.createErrorContainer('Please provide a language when not using reset option.', currentLocale);
				return await interaction.reply(v2Ephemeral(container));
			}

			if (!localeDetector.isLanguageSupported(language)) {
				const supportedLanguages = localeDetector.getSupportedLanguages();
				const languageList = supportedLanguages.map((lang) => `${lang.name} (${lang.code})`).join(', ');
				const container = responseHandler.createErrorContainer(t('responses.language.unsupported', { language, languages: languageList }), currentLocale);
				return await interaction.reply(v2Ephemeral(container));
			}

			if (scope === 'user') {
				const currentUserLang = await localeDetector.getUserLanguage(interaction.user.id);
				if (currentUserLang === language) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const container = responseHandler.createInfoContainer(t('responses.language.same_language', { language: languageName }));
					return await interaction.reply(v2Ephemeral(container));
				}

				const success = await localeDetector.setUserLanguage(interaction.user.id, language);
				if (success) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const container = responseHandler.createSuccessContainer(localizationManager.translate('responses.language.user_set', language, { language: languageName }));
					await interaction.reply(v2Ephemeral(container));
				} else {
					const container = responseHandler.createErrorContainer('Failed to set user language preference.', currentLocale);
					await interaction.reply(v2Ephemeral(container));
				}
			} else if (scope === 'server') {
				if (!interaction.inGuild()) {
					const container = responseHandler.createErrorContainer(t('responses.errors.server_only'), currentLocale);
					return await interaction.reply(v2Ephemeral(container));
				}

				if (!interaction.memberPermissions?.has(discord.PermissionsBitField.Flags.ManageGuild)) {
					const container = responseHandler.createErrorContainer(t('responses.language.no_permission'), currentLocale);
					return await interaction.reply(v2Ephemeral(container));
				}

				const currentGuildLang = await localeDetector.getGuildLanguage(interaction.guildId!);
				if (currentGuildLang === language) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const container = responseHandler.createInfoContainer(t('responses.language.same_language', { language: languageName }));
					return await interaction.reply(v2Ephemeral(container));
				}

				const success = await localeDetector.setGuildLanguage(interaction.guildId!, language);
				if (success) {
					const languageName = localeDetector.getSupportedLanguages().find((l) => l.code === language)?.name || language;
					const container = responseHandler.createSuccessContainer(localizationManager.translate('responses.language.server_set', language, { language: languageName }));
					await interaction.reply(v2(container));
				} else {
					const container = responseHandler.createErrorContainer('Failed to set server language preference.', currentLocale);
					await interaction.reply(v2Ephemeral(container));
				}
			}
		} catch (error) {
			client.logger.error(`[LANGUAGE_COMMAND] Error: ${error}`);
			const container = responseHandler.createErrorContainer(t('responses.errors.general_error'), currentLocale, true);
			if (!interaction.replied) {
				await interaction.reply(v2Ephemeral(container));
			} else {
				await interaction.followUp(v2Ephemeral(container));
			}
		}
	},
};

export default langCommand;
