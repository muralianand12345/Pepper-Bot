import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { Music } from '../../../core/music';
import { LocaleDetector } from '../../../core/locales';

const MUSIC_BUTTON_IDS = ['pause-music', 'resume-music', 'skip-music', 'stop-music', 'loop-music'];

const localeDetector = new LocaleDetector();

const validateButtonInteraction = (interaction: discord.Interaction): interaction is discord.ButtonInteraction => {
	return interaction.isButton() && MUSIC_BUTTON_IDS.includes(interaction.customId);
};

const handleMusicButtonAction = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
	try {
		const music = new Music(client, interaction);

		switch (interaction.customId) {
			case 'pause-music':
				await music.pause();
				break;
			case 'resume-music':
				await music.resume();
				break;
			case 'skip-music':
				await music.skip();
				break;
			case 'stop-music':
				await music.stop();
				break;
			case 'loop-music':
				await music.loop();
				break;
			default:
				client.logger.warn(`[MUSIC_BUTTON] Unknown button interaction: ${interaction.customId}`);
				break;
		}
	} catch (error) {
		client.logger.error(`[MUSIC_BUTTON] Error handling button ${interaction.customId}: ${error}`);

		if (!interaction.replied && !interaction.deferred) {
			try {
				const locale = await localeDetector.detectLocale(interaction);
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.general_error');

				await interaction
					.reply({
						content: `❌ ${message}`,
						flags: discord.MessageFlags.Ephemeral,
					})
					.catch(() => {});
			} catch (localeError) {
				await interaction.reply({ content: '❌ An error occurred while processing your request.', flags: discord.MessageFlags.Ephemeral }).catch(() => {});
			}
		}
	}
};

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		if (!validateButtonInteraction(interaction)) return;

		if (!client.config.music.enabled) {
			try {
				const locale = await localeDetector.detectLocale(interaction);
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.music_disabled');

				await interaction.reply({ content: `❌ ${message}`, flags: discord.MessageFlags.Ephemeral }).catch(() => {});
			} catch (localeError) {
				await interaction
					.reply({
						content: '❌ Music is currently disabled.',
						flags: discord.MessageFlags.Ephemeral,
					})
					.catch(() => {});
			}
			return;
		}

		await handleMusicButtonAction(interaction, client);
	},
};

export default event;
