import discord from 'discord.js';

import { SpotifyManager } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { Command, CommandCategory } from '../types';

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

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
			return await interaction.editReply({ embeds: [embed], components: [row] });
		}
	},
};

export default loginCommand;
