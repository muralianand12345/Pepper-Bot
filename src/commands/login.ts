import discord from 'discord.js';

import { SpotifyManager } from '../core/music';

export default {
	cooldown: 15,
	data: new discord.SlashCommandBuilder()
		.setName('login')
		.setDescription('Connect your music account to Pepper')
		.addStringOption((option) => option.setName('account').setDescription('The music service to connect').setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),

	execute: async (interaction: discord.ChatInputCommandInteraction) => {
		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

		const account = interaction.options.getString('account', true);

		if (account === 'spotify') {
			const existingAccount = await new SpotifyManager(interaction.client).getAccount(interaction.user.id);
			if (existingAccount) {
				const embed = new discord.EmbedBuilder().setColor('#FF4444').setTitle('❌ Already Logged In').setDescription('You already have a Spotify account connected.\n\nPlease use `/logout spotify` if you want to connect a different account.').setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}
			const authUrl = SpotifyManager.generateAuthUrl(interaction.user.id);
			const embed = new discord.EmbedBuilder().setColor('#1DB954').setTitle('🎵 Connect Spotify Account').setDescription('Click the button below to authorize Pepper to access your Spotify account.\n\n**Permissions requested:**\n• Read your playlists').setFooter({ text: 'The authorization link expires in 10 minutes' }).setTimestamp();
			const row = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setLabel('Connect Spotify').setStyle(discord.ButtonStyle.Link).setURL(authUrl).setEmoji('🎵'));
			await interaction.editReply({ embeds: [embed], components: [row] });
		}
	},
};
