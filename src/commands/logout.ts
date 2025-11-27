import discord from 'discord.js';
import { SpotifyManager } from '../core/music';

export default {
	cooldown: 15,
	data: new discord.SlashCommandBuilder()
		.setName('logout')
		.setDescription('Disconnect your music account from Pepper')
		.addStringOption((option) => option.setName('account').setDescription('The music service to disconnect').setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),

	execute: async (interaction: discord.ChatInputCommandInteraction) => {
		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

		const account = interaction.options.getString('account', true);

		if (account === 'spotify') {
			const existingAccount = await new SpotifyManager(interaction.client).getAccount(interaction.user.id);
			if (!existingAccount) {
				const embed = new discord.EmbedBuilder().setColor('#FF4444').setTitle('❌ Not Logged In').setDescription("You don't have a Spotify account connected.\n\nUse `/login spotify` to connect your account.").setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}
			const removed = await new SpotifyManager(interaction.client).removeAccount(interaction.user.id);
			if (!removed) {
				const embed = new discord.EmbedBuilder().setColor('#FF4444').setTitle('❌ Error').setDescription('Failed to disconnect your Spotify account. Please try again later.').setTimestamp();
				await interaction.editReply({ embeds: [embed] });
				return;
			}
			const embed = new discord.EmbedBuilder().setColor('#1DB954').setTitle('✅ Account Disconnected').setDescription('Your Spotify account has been successfully disconnected from Pepper.\n\nYou can reconnect anytime using `/login spotify`.').setTimestamp();
			await interaction.editReply({ embeds: [embed] });
		}
	},
};
