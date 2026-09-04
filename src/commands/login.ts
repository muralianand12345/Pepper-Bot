import discord from 'discord.js';

import { SpotifyManager } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { waitForAuth } from '../utils/authEmitter';
import { v2, withRows, panel } from '../utils/v2';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const buildResultContainer = (result: 'success' | 'failed' | 'timeout', t: (key: string) => string): discord.ContainerBuilder => {
	const configs: Record<string, { color: number; titleKey: string; descriptionKey: string }> = {
		success: {
			color: 0x1db954,
			titleKey: 'responses.login.success.title',
			descriptionKey: 'responses.login.success.description',
		},
		failed: {
			color: 0xff4444,
			titleKey: 'responses.login.failed.title',
			descriptionKey: 'responses.login.failed.description',
		},
		timeout: {
			color: 0xffa500,
			titleKey: 'responses.login.timeout.title',
			descriptionKey: 'responses.login.timeout.description',
		},
	};
	const config = configs[result];
	return panel(config.color, { title: t(config.titleKey), body: t(config.descriptionKey), timestamp: true });
};

const loginCommand: Command = {
	cooldown: 15,
	premium: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('login')
		.setDescription('Connect your music account to Pepper')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.login.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.login.description'))
		.addStringOption((option) => option.setName('account').setDescription('The music service to connect').setNameLocalizations(localizationManager.getCommandLocalizations('commands.login.options.account.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.login.options.account.description')).setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),

	execute: async (interaction: discord.ChatInputCommandInteraction): Promise<discord.Message<boolean> | void> => {
		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

		const t = await localeDetector.getTranslator(interaction);
		const account = interaction.options.getString('account', true);

		if (account === 'spotify') {
			const existingAccount = await new SpotifyManager(interaction.client).getAccount(interaction.user.id);
			if (existingAccount) return await interaction.editReply(v2(panel(0xff4444, { title: t('responses.login.already_logged_in.title'), body: t('responses.login.already_logged_in.description'), timestamp: true })));

			const authUrl = SpotifyManager.generateAuthUrl(interaction.user.id);
			const container = panel(0x1db954, { title: t('responses.login.connect_title'), body: t('responses.login.connect_description'), footer: t('responses.login.auth_footer'), timestamp: true });
			const row = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setLabel('Connect Spotify').setStyle(discord.ButtonStyle.Link).setURL(authUrl).setEmoji('🎵'));
			await interaction.editReply(v2(withRows(container, row)));
			waitForAuth(interaction.user.id, 5 * 60 * 1000).then(async (result) => {
				try {
					await interaction.editReply(v2(buildResultContainer(result, t)));
				} catch (err) {
					console.error('[LOGIN] Failed to update message after auth:', err);
				}
			});
			return;
		}
	},
};

export default loginCommand;
