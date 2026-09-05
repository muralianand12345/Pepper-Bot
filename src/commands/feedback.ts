import discord from 'discord.js';

import { ConfigManager } from '../utils/config';
import { Command, CommandCategory } from '../types';
import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { v2Ephemeral, v2Text, v2Webhook, panel, fields } from '../utils/v2';

const configManager = ConfigManager.getInstance();
const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const feedbackCommand: Command = {
	cooldown: 60,
	category: CommandCategory.UTILITY,
	data: new discord.SlashCommandBuilder().setName('feedback').setDescription('Send feedback to the developers').setNameLocalizations(localizationManager.getCommandLocalizations('commands.feedback.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.feedback.description')),
	modal: async (interaction: discord.ModalSubmitInteraction): Promise<void> => {
		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(interaction.client);

		try {
			const feedbackText = interaction.fields.getTextInputValue('feedback_input');
			const feedbackType = interaction.fields.getTextInputValue('feedback_type');

			const webhookUrl = configManager.getFeedbackWebhook();
			const webhook = new discord.WebhookClient({ url: webhookUrl });

			const details = fields([
				['Type', feedbackType],
				['User', `${interaction.user.tag} (${interaction.user.id})`],
				['Guild', interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'Direct Message'],
				['Timestamp', `<t:${Math.floor(Date.now() / 1000)}:F>`],
			]);

			const container = panel(0x5865f2, {
				title: '📝 New Feedback Received',
				body: `${details}\n\n**Feedback:**\n${feedbackText}`,
				thumbnail: interaction.user.displayAvatarURL(),
				footer: 'Feedback System',
				timestamp: true,
			});

			await webhook.send({ ...v2Webhook(v2Text(`Feedback from ${interaction.user.tag} (${interaction.user.id})`), container), username: 'Feedback Bot', avatarURL: interaction.client.user?.displayAvatarURL() });
			const successContainer = responseHandler.createSuccessContainer(t('responses.feedback.sent'));
			await interaction.reply(v2Ephemeral(successContainer));
		} catch (error) {
			interaction.client.logger.error(`[FEEDBACK] Error sending feedback: ${error}`);
			const errorContainer = responseHandler.createErrorContainer(t('responses.errors.feedback_failed'), locale, true);
			if (!interaction.replied) {
				await interaction.reply(v2Ephemeral(errorContainer));
			} else {
				await interaction.followUp(v2Ephemeral(errorContainer));
			}
		}
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, _client: discord.Client): Promise<void> => {
		const t = await localeDetector.getTranslator(interaction);
		const modal = new discord.ModalBuilder().setCustomId('feedback_modal').setTitle(t('modals.feedback.title'));

		const feedbackTypeInput = new discord.TextInputBuilder().setCustomId('feedback_type').setLabel(t('modals.feedback.type_label')).setPlaceholder(t('modals.feedback.type_placeholder')).setStyle(discord.TextInputStyle.Short).setMaxLength(50).setRequired(true);
		const feedbackInput = new discord.TextInputBuilder().setCustomId('feedback_input').setLabel(t('modals.feedback.feedback_label')).setPlaceholder(t('modals.feedback.feedback_placeholder')).setStyle(discord.TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true);

		const firstRow = new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(feedbackTypeInput);
		const secondRow = new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(feedbackInput);

		modal.addComponents(firstRow, secondRow);
		await interaction.showModal(modal);
	},
};

export default feedbackCommand;
