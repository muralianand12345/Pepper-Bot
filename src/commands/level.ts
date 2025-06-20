import discord from 'discord.js';

import { Command } from '../types';
import { StatsManager } from '../core/music/gamification';
import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const levelCommand: Command = {
	cooldown: 10,
	data: new discord.SlashCommandBuilder()
		.setName('level')
		.setDescription('View your XP level and stats')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.level.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.level.description'))
		.addUserOption((option) => option.setName('user').setDescription("View another user's level (optional)").setNameLocalizations(localizationManager.getCommandLocalizations('commands.level.options.user.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.level.options.user.description')).setRequired(false)),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		await interaction.deferReply();

		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);

		try {
			const targetUser = interaction.options.getUser('user') || interaction.user;
			const statsManager = StatsManager.getInstance(client);
			const userStats = await statsManager.getUserStats(targetUser.id, interaction.guildId || undefined);
			if (!userStats) {
				const embed = responseHandler.createInfoEmbed(t('responses.level.no_stats'), locale);
				await interaction.editReply({ embeds: [embed] });
				return;
			}

			const statsEmbed = await statsManager.createStatsEmbed(targetUser, userStats, interaction.guildId || undefined, locale);
			await interaction.editReply({ embeds: [statsEmbed] });
		} catch (error) {
			client.logger.error(`[LEVEL_COMMAND] Error: ${error}`);
			const embed = responseHandler.createErrorEmbed(t('responses.errors.stats_error'), locale, true);
			await interaction.editReply({ embeds: [embed] });
		}
	},
};

export default levelCommand;
