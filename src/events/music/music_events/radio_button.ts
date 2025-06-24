import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { Music } from '../../../core/music';
import { LocaleDetector } from '../../../core/locales';
import { MusicResponseHandler, RadioManager } from '../../../core/music';

const localeDetector = new LocaleDetector();

const validateRadioButtonInteraction = (interaction: discord.Interaction): interaction is discord.ButtonInteraction => {
	return interaction.isButton() && interaction.customId.startsWith('radio_');
};

const isInteractionExpired = (interaction: discord.ButtonInteraction): boolean => {
	const now = Date.now();
	const interactionTime = interaction.createdTimestamp;
	const maxAge = 15 * 60 * 1000; // 15 minutes
	return now - interactionTime > maxAge;
};

const safeReply = async (interaction: discord.ButtonInteraction, options: discord.InteractionReplyOptions): Promise<boolean> => {
	try {
		if (isInteractionExpired(interaction)) {
			return false;
		}
		await interaction.reply(options);
		return true;
	} catch (error: any) {
		if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
			return false;
		}
		throw error;
	}
};

const safeFollowUp = async (interaction: discord.ButtonInteraction, options: discord.InteractionReplyOptions): Promise<boolean> => {
	try {
		if (isInteractionExpired(interaction)) {
			return false;
		}
		await interaction.followUp(options);
		return true;
	} catch (error: any) {
		if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
			return false;
		}
		throw error;
	}
};

const safeEditReply = async (interaction: discord.ButtonInteraction, options: discord.InteractionEditReplyOptions): Promise<boolean> => {
	try {
		if (isInteractionExpired(interaction)) {
			return false;
		}
		await interaction.editReply(options);
		return true;
	} catch (error: any) {
		if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
			return false;
		}
		throw error;
	}
};

const safeUpdate = async (interaction: discord.ButtonInteraction, options: discord.InteractionUpdateOptions): Promise<boolean> => {
	try {
		if (isInteractionExpired(interaction)) {
			return false;
		}
		await interaction.update(options);
		return true;
	} catch (error: any) {
		if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
			return false;
		}
		throw error;
	}
};

const disableButtons = (components: discord.ActionRowBuilder<discord.ButtonBuilder>[]): discord.ActionRowBuilder<discord.ButtonBuilder>[] => {
	return components.map((row) => {
		const newRow = new discord.ActionRowBuilder<discord.ButtonBuilder>();
		row.components.forEach((button) => {
			const newButton = discord.ButtonBuilder.from(button.toJSON()).setDisabled(true);
			newRow.addComponents(newButton);
		});
		return newRow;
	});
};

const createDisabledComponents = (originalMessage: discord.Message): discord.ActionRowBuilder<discord.ButtonBuilder>[] => {
	const components: discord.ActionRowBuilder<discord.ButtonBuilder>[] = [];

	originalMessage.components.forEach((row) => {
		if (row.type === discord.ComponentType.ActionRow) {
			const actionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>();
			row.components.forEach((component) => {
				if (component.type === discord.ComponentType.Button) {
					const button = new discord.ButtonBuilder()
						.setCustomId(component.customId || 'disabled')
						.setLabel(component.label || 'Disabled')
						.setStyle(component.style)
						.setDisabled(true);
					if (component.emoji) {
						button.setEmoji(component.emoji);
					}
					actionRow.addComponents(button);
				}
			});
			components.push(actionRow);
		}
	});

	return components;
};

const handleRadioButtonAction = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
	if (isInteractionExpired(interaction)) {
		client.logger.warn(`[RADIO_BUTTON] Interaction ${interaction.id} has expired`);
		return;
	}

	try {
		const locale = await localeDetector.detectLocale(interaction);
		const t = await localeDetector.getTranslator(interaction);
		const responseHandler = new MusicResponseHandler(client);

		if (interaction.customId.startsWith('radio_play_')) {
			const stationId = interaction.customId.replace('radio_play_', '');

			const replied = await safeReply(interaction, {
				content: '🔄 ' + t('responses.radio.loading_station'),
				flags: discord.MessageFlags.Ephemeral,
			});

			if (!replied) {
				client.logger.warn(`[RADIO_BUTTON] Could not reply to expired interaction ${interaction.id}`);
				return;
			}

			const radioManager = RadioManager.getInstance(client);
			const station = await radioManager.getStationById(stationId);

			if (!station) {
				await safeEditReply(interaction, {
					content: '❌ ' + t('responses.radio.station_not_found'),
					components: [],
				});
				return;
			}

			const music = new Music(client, interaction);

			try {
				await music.playRadio(station);

				await safeEditReply(interaction, {
					content: '✅ ' + t('responses.radio.playing_station', { station: station.name }),
					components: [],
				});

				const originalMessage = interaction.message;
				if (originalMessage && originalMessage.editable) {
					try {
						const disabledComponents = createDisabledComponents(originalMessage);
						await originalMessage.edit({
							components: disabledComponents.length > 0 ? disabledComponents : [],
						});
					} catch (editError: any) {
						if (editError.code !== 10062) {
							client.logger.warn(`[RADIO_BUTTON] Could not disable buttons: ${editError.message}`);
						}
					}
				}
			} catch (playError) {
				client.logger.error(`[RADIO_BUTTON] Error playing station: ${playError}`);
				await safeEditReply(interaction, {
					content: '❌ ' + t('responses.radio.play_error', { station: station.name }),
					components: [responseHandler.getSupportButton(locale)],
				});
			}
		}
	} catch (error: any) {
		client.logger.error(`[RADIO_BUTTON] Error handling button ${interaction.customId}: ${error}`);

		if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
			client.logger.warn(`[RADIO_BUTTON] Interaction ${interaction.id} expired during processing`);
			return;
		}

		if (!interaction.replied && !interaction.deferred) {
			try {
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.general_error');
				await safeReply(interaction, {
					content: `❌ ${message}`,
					flags: discord.MessageFlags.Ephemeral,
				});
			} catch (localeError) {
				await safeReply(interaction, {
					content: '❌ An error occurred while processing your request.',
					flags: discord.MessageFlags.Ephemeral,
				});
			}
		}
	}
};

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		if (!validateRadioButtonInteraction(interaction)) return;

		if (!client.config.music.enabled) {
			if (isInteractionExpired(interaction)) {
				client.logger.warn(`[RADIO_BUTTON] Music disabled but interaction ${interaction.id} has expired`);
				return;
			}

			try {
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.music_disabled');
				await safeReply(interaction, {
					content: `❌ ${message}`,
					flags: discord.MessageFlags.Ephemeral,
				});
			} catch (localeError) {
				await safeReply(interaction, {
					content: '❌ Music is currently disabled.',
					flags: discord.MessageFlags.Ephemeral,
				});
			}
			return;
		}

		await handleRadioButtonAction(interaction, client);
	},
};

export default event;
