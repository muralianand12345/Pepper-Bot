import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { MusicResponseHandler, LavaLink } from '../../../core/music';
import { LocaleDetector } from '../../../core/locales';

const LAVALINK_BUTTON_IDS = ['refresh_lavalink_status', 'remove_lavalink_quick', 'confirm_lavalink_removal', 'cancel_lavalink_removal'];

const localeDetector = new LocaleDetector();

const validateLavalinkButtonInteraction = (interaction: discord.Interaction): interaction is discord.ButtonInteraction => {
	return interaction.isButton() && LAVALINK_BUTTON_IDS.includes(interaction.customId);
};

const handleLavalinkButtonAction = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
	try {
		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);
		const lavalink = new LavaLink(client);

		switch (interaction.customId) {
			case 'refresh_lavalink_status': {
				await interaction.deferUpdate();

				const userLavalink = await lavalink.getUserLavalink(interaction.user.id);
				if (!userLavalink) {
					const embed = responseHandler.createErrorEmbed(t('responses.lavalink.not_found'), locale);
					await interaction.editReply({ embeds: [embed], components: [] });
					return;
				}

				const node = client.manager.nodes.find((n) => n.options.identifier === userLavalink.identifier);
				const isConnected = node?.connected || false;
				const status = isConnected ? '🟢 ' + t('responses.lavalink.status.connected') : '🔴 ' + t('responses.lavalink.status.disconnected');

				const embed = new discord.EmbedBuilder()
					.setColor(isConnected ? '#43b581' : '#f04747')
					.setTitle('🔧 ' + t('responses.lavalink.personal_node_info'))
					.addFields([
						{
							name: t('responses.lavalink.fields.connection'),
							value: `**${t('responses.lavalink.fields.host')}:** ${userLavalink.host}\n**${t('responses.lavalink.fields.port')}:** ${userLavalink.port}\n**${t('responses.lavalink.fields.secure')}:** ${userLavalink.secure ? t('responses.lavalink.yes') : t('responses.lavalink.no')}`,
							inline: true,
						},
						{
							name: t('responses.lavalink.fields.status'),
							value: status,
							inline: true,
						},
						{
							name: t('responses.lavalink.fields.settings'),
							value: `**${t('responses.lavalink.fields.auto_fallback')}:** ${userLavalink.autoFallback ? t('responses.lavalink.enabled') : t('responses.lavalink.disabled')}\n**${t('responses.lavalink.fields.retry_count')}:** ${userLavalink.retryCount || 0}/5`,
							inline: true,
						},
					])
					.setFooter({
						text: userLavalink.addedAt ? t('responses.lavalink.added_on', { date: userLavalink.addedAt.toLocaleDateString() }) : t('responses.lavalink.no_date'),
						iconURL: client.user?.displayAvatarURL(),
					})
					.setTimestamp();

				if (userLavalink.lastError) {
					embed.addFields([
						{
							name: t('responses.lavalink.fields.last_error'),
							value: userLavalink.lastError,
							inline: false,
						},
					]);
				}

				const actionButtons = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('refresh_lavalink_status').setLabel(t('responses.lavalink.buttons.refresh')).setStyle(discord.ButtonStyle.Primary).setEmoji('🔄'), new discord.ButtonBuilder().setCustomId('remove_lavalink_quick').setLabel(t('responses.lavalink.buttons.remove')).setStyle(discord.ButtonStyle.Danger).setEmoji('🗑️'));

				await interaction.editReply({
					embeds: [embed],
					components: [actionButtons],
				});
				break;
			}

			case 'remove_lavalink_quick': {
				const userLavalink = await lavalink.getUserLavalink(interaction.user.id);
				if (!userLavalink) {
					const embed = responseHandler.createErrorEmbed(t('responses.lavalink.not_found'), locale);
					await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
					return;
				}

				const confirmEmbed = new discord.EmbedBuilder()
					.setColor('#faa61a')
					.setTitle('⚠️ ' + t('responses.lavalink.confirm_removal'))
					.setDescription(
						t('responses.lavalink.removal_warning', {
							host: userLavalink.host || 'Unknown',
							port: userLavalink.port?.toString() || 'Unknown',
						})
					)
					.setFooter({ text: t('responses.lavalink.removal_timeout'), iconURL: client.user?.displayAvatarURL() });

				const confirmButton = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('confirm_lavalink_removal').setLabel(t('responses.lavalink.buttons.confirm')).setStyle(discord.ButtonStyle.Danger).setEmoji('⚠️'), new discord.ButtonBuilder().setCustomId('cancel_lavalink_removal').setLabel(t('responses.lavalink.buttons.cancel')).setStyle(discord.ButtonStyle.Secondary).setEmoji('❌'));

				await interaction.reply({
					embeds: [confirmEmbed],
					components: [confirmButton],
					flags: discord.MessageFlags.Ephemeral,
				});
				break;
			}

			case 'confirm_lavalink_removal': {
				await interaction.deferUpdate();

				const result = await lavalink.removeUserLavalink(interaction.user.id);

				if (result.success) {
					const embed = responseHandler.createSuccessEmbed(t('responses.lavalink.removed_successfully'), locale);
					await interaction.editReply({ embeds: [embed], components: [] });
				} else {
					const embed = responseHandler.createErrorEmbed(t('responses.lavalink.remove_failed', { error: result.error || 'Unknown error' }), locale);
					await interaction.editReply({ embeds: [embed], components: [] });
				}
				break;
			}

			case 'cancel_lavalink_removal': {
				const embed = responseHandler.createInfoEmbed(t('responses.lavalink.removal_cancelled'), locale);
				await interaction.update({ embeds: [embed], components: [] });
				break;
			}

			default:
				client.logger.warn(`[LAVALINK_BUTTON] Unknown button interaction: ${interaction.customId}`);
				break;
		}
	} catch (error) {
		client.logger.error(`[LAVALINK_BUTTON] Error handling button ${interaction.customId}: ${error}`);

		if (!interaction.replied && !interaction.deferred) {
			try {
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.general_error');

				await interaction
					.reply({
						content: `❌ ${message}`,
						flags: discord.MessageFlags.Ephemeral,
					})
					.catch(() => {});
			} catch (localeError) {
				await interaction
					.reply({
						content: '❌ An error occurred while processing your request.',
						flags: discord.MessageFlags.Ephemeral,
					})
					.catch(() => {});
			}
		}
	}
};

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		if (!validateLavalinkButtonInteraction(interaction)) return;
		await handleLavalinkButtonAction(interaction, client);
	},
};

export default event;
