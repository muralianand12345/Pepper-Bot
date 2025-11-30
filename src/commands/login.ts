import discord from 'discord.js';

import { SpotifyManager } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { waitForAuth } from '../utils/authEmitter';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const buildResultEmbed = (result: 'success' | 'failed' | 'timeout', t: (key: string) => string): discord.EmbedBuilder => {
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
	return new discord.EmbedBuilder().setColor(config.color).setTitle(t(config.titleKey)).setDescription(t(config.descriptionKey)).setTimestamp();
};

const loginCommand: Command = {
	cooldown: 15,
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
			if (existingAccount) {
				const embed = new discord.EmbedBuilder().setColor('#FF4444').setTitle(t('responses.login.already_logged_in.title')).setDescription(t('responses.login.already_logged_in.description')).setTimestamp();
				return await interaction.editReply({ embeds: [embed] });
			}
			const authUrl = SpotifyManager.generateAuthUrl(interaction.user.id);
			const embed = new discord.EmbedBuilder()
				.setColor('#1DB954')
				.setTitle(t('responses.login.connect_title'))
				.setDescription(t('responses.login.connect_description'))
				.setFooter({ text: t('responses.login.auth_footer') })
				.setTimestamp();
			const row = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setLabel('Connect Spotify').setStyle(discord.ButtonStyle.Link).setURL(authUrl).setEmoji('🎵'));
			await interaction.editReply({ embeds: [embed], components: [row] });
			waitForAuth(interaction.user.id, 5 * 60 * 1000).then(async (result) => {
				try {
					const resultEmbed = buildResultEmbed(result, t);
					await interaction.editReply({ embeds: [resultEmbed], components: [] });
				} catch (err) {
					console.error('[LOGIN] Failed to update embed after auth:', err);
				}
			});
			return;
		}
	},
};

export default loginCommand;
