import discord from 'discord.js';

import { LocaleDetector } from '../core/locales';

export class SurveyHandler {
	private static instance: SurveyHandler;
	private localeDetector: LocaleDetector;
	private lastSentUsers: Set<string> = new Set();
	private readonly COOLDOWN_TIME = 24 * 60 * 60 * 1000; // 24 hours

	private constructor() {
		this.localeDetector = new LocaleDetector();
		this.startCleanupTimer();
	}

	public static getInstance = (): SurveyHandler => {
		if (!SurveyHandler.instance) SurveyHandler.instance = new SurveyHandler();
		return SurveyHandler.instance;
	};

	private startCleanupTimer = (): void => {
		setInterval(() => this.lastSentUsers.clear(), this.COOLDOWN_TIME);
	};

	public shouldSendSurvey = (client: discord.Client, userId: string): boolean => {
		if (!client.config.survey?.enabled) return false;
		if (this.lastSentUsers.has(userId)) return false;

		const probability = client.config.survey.probability || 0.05;
		return Math.random() < probability;
	};

	public sendSurvey = async (client: discord.Client, interaction: discord.ChatInputCommandInteraction): Promise<void> => {
		try {
			if (!this.shouldSendSurvey(client, interaction.user.id)) return;

			const t = await this.localeDetector.getTranslator(interaction);

			const surveyEmbed = new discord.EmbedBuilder()
				.setColor('#5865f2')
				.setTitle(t('survey.title'))
				.setDescription(t('survey.description'))
				.setFooter({ text: t('survey.footer'), iconURL: client.user?.displayAvatarURL() })
				.setTimestamp();

			const surveyButton = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
				new discord.ButtonBuilder()
					.setLabel(t('survey.button'))
					.setStyle(discord.ButtonStyle.Link)
					.setURL(client.config.survey?.url || '')
					.setEmoji('📋'),
				new discord.ButtonBuilder().setLabel(t('responses.buttons.support_server')).setStyle(discord.ButtonStyle.Link).setURL('https://discord.gg/XzE9hSbsNb').setEmoji('🔧')
			);

			await interaction.followUp({ embeds: [surveyEmbed], components: [surveyButton], flags: discord.MessageFlags.Ephemeral });

			this.lastSentUsers.add(interaction.user.id);
			client.logger.info(`[SURVEY] Sent survey to user ${interaction.user.tag} (${interaction.user.id})`);
		} catch (error) {
			client.logger.error(`[SURVEY] Error sending survey: ${error}`);
		}
	};

	public addUserToCooldown = (userId: string): void => {
		this.lastSentUsers.add(userId);
	};

	public removeUserFromCooldown = (userId: string): void => {
		this.lastSentUsers.delete(userId);
	};

	public isUserOnCooldown = (userId: string): boolean => {
		return this.lastSentUsers.has(userId);
	};
}
