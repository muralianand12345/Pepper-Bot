import discord from 'discord.js';

import { Command } from '../types';
import { LavaLink } from '../core/music/lavalink';
import { MusicResponseHandler } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';

export { LavaLink };

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const lavalinkCommand: Command = {
	cooldown: 10,
	data: new discord.SlashCommandBuilder()
		.setName('lavalink')
		.setDescription('Manage your personal Lavalink node')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.description'))
		.addSubcommand((subcommand) =>
			subcommand
				.setName('add')
				.setDescription('Add your personal Lavalink node')
				.setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.name'))
				.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.description'))
				.addStringOption((option) => option.setName('host').setDescription('Lavalink host/IP address').setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.host.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.host.description')).setRequired(true))
				.addIntegerOption((option) => option.setName('port').setDescription('Lavalink port').setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.port.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.port.description')).setRequired(true).setMinValue(1).setMaxValue(65535))
				.addStringOption((option) => option.setName('password').setDescription('Lavalink password').setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.password.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.password.description')).setRequired(true))
				.addBooleanOption((option) => option.setName('secure').setDescription('Use secure connection (SSL/TLS)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.secure.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.secure.description')).setRequired(false))
				.addBooleanOption((option) => option.setName('auto_fallback').setDescription('Auto switch to default nodes if this fails').setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.auto_fallback.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.add.options.auto_fallback.description')).setRequired(false))
		)
		.addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove your personal Lavalink node').setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.remove.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.remove.description')))
		.addSubcommand((subcommand) => subcommand.setName('info').setDescription('View your personal Lavalink information').setNameLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.info.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.lavalink.info.description'))),

	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);
		const lavalink = new LavaLink(client);

		const subcommand = interaction.options.getSubcommand();

		try {
			switch (subcommand) {
				case 'add': {
					const host = interaction.options.getString('host', true);
					const port = interaction.options.getInteger('port', true);
					const password = interaction.options.getString('password', true);
					const secure = interaction.options.getBoolean('secure') ?? false;
					const autoFallback = interaction.options.getBoolean('auto_fallback') ?? true;

					if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
						const embed = responseHandler.createErrorEmbed(t('responses.lavalink.invalid_host'), locale);
						await interaction.editReply({ embeds: [embed] });
						return;
					}

					const existingLavalink = await lavalink.getUserLavalink(interaction.user.id);
					if (existingLavalink) {
						const embed = responseHandler.createErrorEmbed(t('responses.lavalink.already_exists'), locale);
						await interaction.editReply({ embeds: [embed] });
						return;
					}

					const config = { host, port, password, secure, autoFallback };
					const connectionEmbed = responseHandler.createInfoEmbed(t('responses.lavalink.testing_connection'), locale);
					await interaction.editReply({ embeds: [connectionEmbed] });

					const result = await lavalink.addUserLavalink(interaction.user.id, config);

					if (result.success) {
						const embed = responseHandler.createSuccessEmbed(t('responses.lavalink.added_successfully', { host, port: port.toString(), nodeId: result.nodeId || 'Unknown' }), locale);
						await interaction.editReply({ embeds: [embed] });
					} else {
						const embed = responseHandler.createErrorEmbed(t('responses.lavalink.add_failed', { error: result.error || 'Unknown error' }), locale);
						await interaction.editReply({ embeds: [embed] });
					}
					break;
				}

				case 'remove': {
					const existingLavalink = await lavalink.getUserLavalink(interaction.user.id);
					if (!existingLavalink) {
						const embed = responseHandler.createErrorEmbed(t('responses.lavalink.not_found'), locale);
						await interaction.editReply({ embeds: [embed] });
						return;
					}

					const confirmEmbed = new discord.EmbedBuilder()
						.setColor('#faa61a')
						.setTitle('⚠️ ' + t('responses.lavalink.confirm_removal'))
						.setDescription(t('responses.lavalink.removal_warning', { host: existingLavalink.host || 'Unknown', port: existingLavalink.port?.toString() || 'Unknown' }))
						.setFooter({ text: t('responses.lavalink.removal_timeout'), iconURL: client.user?.displayAvatarURL() });

					const confirmButton = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('confirm_lavalink_removal').setLabel(t('responses.lavalink.buttons.confirm')).setStyle(discord.ButtonStyle.Danger).setEmoji('⚠️'), new discord.ButtonBuilder().setCustomId('cancel_lavalink_removal').setLabel(t('responses.lavalink.buttons.cancel')).setStyle(discord.ButtonStyle.Secondary).setEmoji('❌'));
					const message = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmButton] });
					const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 30000 });

					collector.on('collect', async (i) => {
						if (i.customId === 'confirm_lavalink_removal') {
							const result = await lavalink.removeUserLavalink(interaction.user.id);

							if (result.success) {
								const embed = responseHandler.createSuccessEmbed(t('responses.lavalink.removed_successfully'), locale);
								await i.update({ embeds: [embed], components: [] });
							} else {
								const embed = responseHandler.createErrorEmbed(t('responses.lavalink.remove_failed', { error: result.error || 'Unknown error' }), locale);
								await i.update({ embeds: [embed], components: [] });
							}
						} else {
							const embed = responseHandler.createInfoEmbed(t('responses.lavalink.removal_cancelled'), locale);
							await i.update({ embeds: [embed], components: [] });
						}
					});

					collector.on('end', async (collected) => {
						if (collected.size === 0) {
							const embed = responseHandler.createInfoEmbed(t('responses.lavalink.removal_timeout_msg'), locale);
							await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
						}
					});
					break;
				}

				case 'info': {
					const userLavalink = await lavalink.getUserLavalink(interaction.user.id);

					if (!userLavalink) {
						const embed = new discord.EmbedBuilder()
							.setColor('#5865f2')
							.setTitle('🔧 ' + t('responses.lavalink.no_personal_node'))
							.setDescription(t('responses.lavalink.setup_instructions'))
							.addFields([
								{
									name: t('responses.lavalink.default_nodes'),
									value:
										client.manager.nodes
											.filter((node) => !node.options.identifier?.startsWith('user_'))
											.map((node) => {
												const status = node.connected ? '🟢' : '🔴';
												return `${status} **${node.options.identifier}** - ${node.options.host}:${node.options.port}`;
											})
											.join('\n') || t('responses.lavalink.no_default_nodes'),
									inline: false,
								},
							])
							.setFooter({ text: t('responses.lavalink.add_personal_footer'), iconURL: client.user?.displayAvatarURL() });

						await interaction.editReply({ embeds: [embed] });
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
						});

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

					await interaction.editReply({ embeds: [embed], components: [actionButtons] });
					break;
				}

				default: {
					const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale);
					await interaction.editReply({ embeds: [embed] });
				}
			}
		} catch (error) {
			client.logger.error(`[LAVALINK_COMMAND] Error: ${error}`);
			const embed = responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale, true);
			await interaction.editReply({ embeds: [embed] });
		}
	},
};

export default lavalinkCommand;
