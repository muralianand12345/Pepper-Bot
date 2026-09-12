import discord from 'discord.js';

import { SpotifyManager } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { v2, panel } from '../utils/v2';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const loginCommand: Command = {
	cooldown: 15,
	premium: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('login')
		.setDescription('Connect your music account to Pepper')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.login.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.login.description'))
		.addStringOption((option) => option.setName('account').setDescription('The music service to connect').setNameLocalizations(localizationManager.getCommandLocalizations('commands.login.options.account.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.login.options.account.description')).setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' }))
		.addStringOption((option) => option.setName('profile').setDescription('Your Spotify profile link (Spotify app > Profile > Share > Copy link)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.login.options.profile.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.login.options.profile.description')).setRequired(true)),

	execute: async (interaction: discord.ChatInputCommandInteraction): Promise<discord.Message<boolean> | void> => {
		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

		const t = await localeDetector.getTranslator(interaction);
		const account = interaction.options.getString('account', true);
		if (account !== 'spotify') return;

		const manager = new SpotifyManager(interaction.client);
		const existing = await manager.getLinkedAccount(interaction.user.id);
		if (existing) return await interaction.editReply(v2(panel(0xff4444, { title: t('responses.login.already_logged_in.title'), body: t('responses.login.already_logged_in.description'), timestamp: true })));

		const spotifyId = SpotifyManager.parseProfileInput(interaction.options.getString('profile', true));
		if (!spotifyId) return await interaction.editReply(v2(panel(0xff4444, { title: t('responses.login.invalid_profile.title'), body: t('responses.login.invalid_profile.description'), timestamp: true })));

		const resolved = await manager.resolveProfile(spotifyId);
		if (!resolved) return await interaction.editReply(v2(panel(0xff4444, { title: t('responses.login.profile_not_found.title'), body: t('responses.login.profile_not_found.description'), timestamp: true })));

		const saved = await manager.saveProfile(interaction.user.id, resolved.id, resolved.username);
		if (!saved) return await interaction.editReply(v2(panel(0xff4444, { title: t('responses.login.failed.title'), body: t('responses.login.failed.description'), timestamp: true })));

		return await interaction.editReply(v2(panel(0x1db954, { title: t('responses.login.success.title'), body: t('responses.login.linked_description', { username: resolved.username }), timestamp: true })));
	},
};

export default loginCommand;
