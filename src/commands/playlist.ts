import discord from 'discord.js';

import { AutoComplete } from '../core/commands';
import { Command, CommandCategory } from '../types';
import { LocalizationManager } from '../core/locales';
import { Playlist, PLAYLIST_CONFIG } from '../core/music';

const localizationManager = LocalizationManager.getInstance();

const describe = <T extends discord.SharedNameAndDescription>(builder: T, key: string): T =>
	builder
		.setName(localizationManager.translate(`commands.playlist.${key}.name`, 'en'))
		.setDescription(localizationManager.translate(`commands.playlist.${key}.description`, 'en'))
		.setNameLocalizations(localizationManager.getCommandLocalizations(`commands.playlist.${key}.name`))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations(`commands.playlist.${key}.description`));

const visibilityChoices = (['public', 'private'] as const).map((value) => ({ name: localizationManager.translate(`commands.playlist.choices.${value}`, 'en'), name_localizations: localizationManager.getCommandLocalizations(`commands.playlist.choices.${value}`), value }));

const playlistOption = (option: discord.SlashCommandStringOption, key: string = 'options.playlist') => describe(option, key).setRequired(true).setAutocomplete(true);

const positionOption = (option: discord.SlashCommandIntegerOption, key: string) => describe(option, `options.${key}`).setRequired(true).setMinValue(1).setAutocomplete(true);

const playlistCommand: Command = {
	cooldown: 3,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('playlist')
		.setDescription(localizationManager.translate('commands.playlist.description', 'en'))
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.playlist.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.playlist.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addSubcommand((sub) =>
			describe(sub, 'subcommands.create')
				.addStringOption((option) => describe(option, 'options.name').setRequired(true).setMaxLength(PLAYLIST_CONFIG.NAME_MAX_LENGTH))
				.addStringOption((option) => describe(option, 'options.visibility').setRequired(false).addChoices(...visibilityChoices)),
		)
		.addSubcommand((sub) => describe(sub, 'subcommands.delete').addStringOption((option) => playlistOption(option)))
		.addSubcommand((sub) =>
			describe(sub, 'subcommands.rename')
				.addStringOption((option) => playlistOption(option))
				.addStringOption((option) => describe(option, 'options.new_name').setRequired(true).setMaxLength(PLAYLIST_CONFIG.NAME_MAX_LENGTH)),
		)
		.addSubcommand((sub) => describe(sub, 'subcommands.list'))
		.addSubcommand((sub) => describe(sub, 'subcommands.view').addStringOption((option) => playlistOption(option, 'options.playlist_or_code')))
		.addSubcommand((sub) => describe(sub, 'subcommands.share').addStringOption((option) => playlistOption(option)))
		.addSubcommand((sub) =>
			describe(sub, 'subcommands.visibility')
				.addStringOption((option) => playlistOption(option))
				.addStringOption((option) => describe(option, 'options.state').setRequired(true).addChoices(...visibilityChoices)),
		)
		.addSubcommand((sub) =>
			describe(sub, 'subcommands.transfer')
				.addStringOption((option) => playlistOption(option))
				.addUserOption((option) => describe(option, 'options.user').setRequired(true)),
		)
		.addSubcommandGroup((group) =>
			describe(group, 'groups.song')
				.addSubcommand((sub) =>
					describe(sub, 'groups.song.subcommands.add')
						.addStringOption((option) => playlistOption(option))
						.addStringOption((option) => describe(option, 'options.song').setRequired(true).setAutocomplete(true)),
				)
				.addSubcommand((sub) => describe(sub, 'groups.song.subcommands.current').addStringOption((option) => playlistOption(option)))
				.addSubcommand((sub) =>
					describe(sub, 'groups.song.subcommands.remove')
						.addStringOption((option) => playlistOption(option))
						.addIntegerOption((option) => positionOption(option, 'position')),
				)
				.addSubcommand((sub) =>
					describe(sub, 'groups.song.subcommands.move')
						.addStringOption((option) => playlistOption(option))
						.addIntegerOption((option) => positionOption(option, 'from'))
						.addIntegerOption((option) => positionOption(option, 'to')),
				),
		),
	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		const autoComplete = new AutoComplete(client, interaction);
		await autoComplete.playlistAutocomplete();
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const playlist = new Playlist(client, interaction);
		await playlist.execute();
	},
};

export default playlistCommand;
