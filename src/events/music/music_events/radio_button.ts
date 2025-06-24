import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { Music } from '../../../core/music';
import { LocaleDetector } from '../../../core/locales';
import { MusicResponseHandler, RadioManager } from '../../../core/music';

const localeDetector = new LocaleDetector();

const validateRadioButtonInteraction = (interaction: discord.Interaction): interaction is discord.ButtonInteraction => {
	return interaction.isButton() && interaction.customId.startsWith('radio_');
};

const handleRadioButtonAction = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<discord.Message<boolean> | void> => {
	try {
		const locale = await localeDetector.detectLocale(interaction);
		const t = await localeDetector.getTranslator(interaction);
		const responseHandler = new MusicResponseHandler(client);

		if (interaction.customId.startsWith('radio_play_')) {
			const stationId = interaction.customId.replace('radio_play_', '');

			await interaction.deferUpdate();

			const radioManager = RadioManager.getInstance(client);
			const station = await radioManager.getStationById(stationId);
			if (!station) return await interaction.followUp({ embeds: [responseHandler.createErrorEmbed(t('responses.radio.station_not_found'), locale)], flags: discord.MessageFlags.Ephemeral });

			const music = new Music(client, interaction);

			try {
				await music.playRadio(station);
				await interaction.followUp({ embeds: [responseHandler.createSuccessEmbed(t('responses.radio.playing_station', { station: station.name }), locale)], flags: discord.MessageFlags.Ephemeral });

				const updatedComponents = interaction.message.components.map((row) => {
					const actionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>();
					if (row.type === discord.ComponentType.ActionRow) {
						row.components.forEach((component) => {
							if (component.type === discord.ComponentType.Button) {
								const button = new discord.ButtonBuilder()
									.setCustomId(component.customId || 'disabled')
									.setLabel(component.label || 'Disabled')
									.setStyle(component.style)
									.setDisabled(true);
								if (component.emoji) button.setEmoji(component.emoji);
								actionRow.addComponents(button);
							}
						});
					}

					return actionRow;
				});

				await interaction.editReply({ components: updatedComponents });
			} catch (error) {
				client.logger.error(`[RADIO_BUTTON] Error playing station: ${error}`);
				await interaction.followUp({ embeds: [responseHandler.createErrorEmbed(t('responses.radio.play_error', { station: station.name }), locale, true)], components: [responseHandler.getSupportButton(locale)], flags: discord.MessageFlags.Ephemeral });
			}
		}
	} catch (error) {
		client.logger.error(`[RADIO_BUTTON] Error handling button ${interaction.customId}: ${error}`);
		if (!interaction.replied && !interaction.deferred) {
			try {
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.general_error');
				await interaction.reply({ content: `❌ ${message}`, flags: discord.MessageFlags.Ephemeral }).catch(() => {});
			} catch (localeError) {
				await interaction.reply({ content: '❌ An error occurred while processing your request.', flags: discord.MessageFlags.Ephemeral }).catch(() => {});
			}
		}
	}
};

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		if (!validateRadioButtonInteraction(interaction)) return;

		if (!client.config.music.enabled) {
			try {
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.music_disabled');
				await interaction.reply({ content: `❌ ${message}`, flags: discord.MessageFlags.Ephemeral }).catch(() => {});
			} catch (localeError) {
				await interaction.reply({ content: '❌ Music is currently disabled.', flags: discord.MessageFlags.Ephemeral }).catch(() => {});
			}
			return;
		}
		await handleRadioButtonAction(interaction, client);
	},
};

export default event;
