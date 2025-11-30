import discord from 'discord.js';

import { SpotifyManager } from '../core/music';
import { Command, CommandCategory } from '../types';
import { LocalizationManager, LocaleDetector } from '../core/locales';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

export const logoutCommand: Command = {
	cooldown: 15,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('logout')
		.setDescription('Disconnect your music account from Pepper')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.logout.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.logout.description'))
		.addStringOption((option) => option.setName('account').setDescription('The music service to disconnect').setNameLocalizations(localizationManager.getCommandLocalizations('commands.logout.options.account.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.logout.options.account.description')).setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),

	execute: async (interaction: discord.ChatInputCommandInteraction): Promise<discord.Message<boolean> | void> => {
		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

		const t = await localeDetector.getTranslator(interaction);
		const account = interaction.options.getString('account', true);

		if (account === 'spotify') {
			const existingAccount = await new SpotifyManager(interaction.client).getAccount(interaction.user.id);
			if (!existingAccount) {
				const embed = new discord.EmbedBuilder().setColor('#FF4444').setTitle(t('responses.logout.not_logged_in.title')).setDescription(t('responses.logout.not_logged_in.description')).setTimestamp();
				return await interaction.editReply({ embeds: [embed] });
			}
			const removed = await new SpotifyManager(interaction.client).removeAccount(interaction.user.id);
			if (!removed) {
				const embed = new discord.EmbedBuilder().setColor('#FF4444').setTitle(t('responses.logout.disconnect_error.title')).setDescription(t('responses.logout.disconnect_error.description')).setTimestamp();
				return await interaction.editReply({ embeds: [embed] });
			}
			const embed = new discord.EmbedBuilder().setColor('#1DB954').setTitle(t('responses.logout.disconnected.title')).setDescription(t('responses.logout.disconnected.description')).setTimestamp();
			return await interaction.editReply({ embeds: [embed] });
		}
	},
};

export default logoutCommand;
