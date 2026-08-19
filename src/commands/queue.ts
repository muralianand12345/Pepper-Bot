import discord from 'discord.js';
import magmastream from 'magmastream';

import { Music } from '../core/music';
import Formatter from '../utils/format';
import { Command, CommandCategory } from '../types';
import { getRequester, MusicResponseHandler, ProgressBarUtils } from '../core/music';
import { LocalizationManager, LocaleDetector, TranslatorFunction } from '../core/locales';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const createQueueEmbed = async (player: magmastream.Player, queueTracks: magmastream.Track[], currentPage: number, t: TranslatorFunction, client: discord.Client): Promise<discord.EmbedBuilder> => {
	const itemsPerPage = 10;
	const startIndex = currentPage * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const queuePage = queueTracks.slice(startIndex, endIndex);
	const currentTrack = await player.queue.getCurrent();

	const embed = new discord.EmbedBuilder()
		.setColor('#5865f2')
		.setTitle(`🎵 ${t('responses.queue.title')}`)
		.setTimestamp()
		.setFooter({ text: queueTracks.length > 0 ? `${t('responses.queue.page')} ${currentPage + 1}/${Math.ceil(queueTracks.length / itemsPerPage)} • ${client.user?.username || 'Music Bot'}` : `${client.user?.username || 'Music Bot'}`, iconURL: client.user?.displayAvatarURL() });

	if (currentTrack) {
		const currentTitle = Formatter.truncateText(currentTrack.title || 'Unknown', 40);
		const currentArtist = Formatter.truncateText(currentTrack.author || 'Unknown', 25);
		const isStream = Boolean(currentTrack.isStream);
		const durationMs = Number(currentTrack.duration || 0);
		const currentDuration = isStream ? t('responses.queue.live') : durationMs > 0 ? Formatter.msToTime(durationMs) : '00:00:00';
		const progress = player.playing ? ProgressBarUtils.createBarFromPlayer(player, durationMs) : null;
		const progressBar = progress ? `${progress.bar}\n\`${progress.formattedPosition} / ${progress.formattedDuration}\`` : '';

		embed.addFields({ name: `🎵 ${t('responses.queue.now_playing')}`, value: `**${currentTitle}** - ${currentArtist}\n└ ${currentDuration}`, inline: false });
		if (progressBar) embed.addFields({ name: `⏱️ ${t('responses.queue.progress')}`, value: progressBar, inline: false });
	}

	if (queuePage.length > 0) {
		const queueList = queuePage
			.map((track, index) => {
				const position = startIndex + index + 1;
				const title = Formatter.truncateText((track?.title as string) || 'Unknown', 35);
				const artist = Formatter.truncateText((track?.author as string) || 'Unknown', 20);
				const isStream = Boolean(track?.isStream);
				const durationMs = Number(track?.duration || 0);
				const duration = isStream ? t('responses.queue.live') : durationMs > 0 ? Formatter.msToTime(durationMs) : '00:00:00';
				const requesterData = track?.requester ? getRequester(client, track.requester) : null;
				const requester = requesterData ? ` • ${requesterData.username}` : '';
				return `**${position}.** **${title}** - ${artist}\n└ ${duration}${requester}`;
			})
			.join('\n\n');

		embed.addFields({ name: `📋 ${t('responses.queue.upcoming')} (${queueTracks.length})`, value: queueList.length > 1024 ? queueList.substring(0, 1021) + '...' : queueList, inline: false });
	}

	const totalDuration = queueTracks.reduce((acc, track) => {
		const isStream = Boolean(track?.isStream);
		const dur = Number(track?.duration || 0);
		return acc + (isStream ? 0 : Math.max(0, dur));
	}, 0);
	const totalFormatted = Formatter.msToTime(totalDuration);
	const streamCount = queueTracks.filter((track) => track.isStream).length;

	let description = `**${queueTracks.length}** ${t('responses.queue.tracks_in_queue')}`;
	if (totalDuration > 0) description += `\n**${totalFormatted}** ${t('responses.queue.total_duration')}`;
	if (streamCount > 0) description += `\n**${streamCount}** ${t('responses.queue.live_streams')}`;

	embed.setDescription(description);
	if (currentTrack && (currentTrack.thumbnail || currentTrack.artworkUrl)) embed.setThumbnail(currentTrack.thumbnail || currentTrack.artworkUrl);
	return embed;
};

const createQueueButtons = (page: number, totalPages: number, isEmpty: boolean, t: TranslatorFunction, queueLength: number = 0): discord.ActionRowBuilder<discord.ButtonBuilder>[] => {
	const navigationRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
		new discord.ButtonBuilder()
			.setCustomId('queue-previous')
			.setLabel(t('responses.queue.buttons.previous'))
			.setStyle(discord.ButtonStyle.Secondary)
			.setEmoji('⬅️')
			.setDisabled(page === 0 || isEmpty),
		new discord.ButtonBuilder()
			.setCustomId('queue-next')
			.setLabel(t('responses.queue.buttons.next'))
			.setStyle(discord.ButtonStyle.Secondary)
			.setEmoji('➡️')
			.setDisabled(page >= totalPages - 1 || isEmpty),
		new discord.ButtonBuilder()
			.setCustomId('queue-shuffle')
			.setLabel(t('responses.queue.buttons.shuffle'))
			.setStyle(discord.ButtonStyle.Primary)
			.setEmoji('🔀')
			.setDisabled(isEmpty || queueLength < 2),
		new discord.ButtonBuilder()
			.setCustomId('queue-move')
			.setLabel(t('responses.queue.buttons.move'))
			.setStyle(discord.ButtonStyle.Secondary)
			.setEmoji('🔄')
			.setDisabled(isEmpty || queueLength < 2),
	);

	const actionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(new discord.ButtonBuilder().setCustomId('queue-remove').setLabel(t('responses.queue.buttons.remove')).setStyle(discord.ButtonStyle.Secondary).setEmoji('➖').setDisabled(isEmpty), new discord.ButtonBuilder().setCustomId('queue-clear').setLabel(t('responses.queue.buttons.clear')).setStyle(discord.ButtonStyle.Danger).setEmoji('🗑️').setDisabled(isEmpty));

	return [navigationRow, actionRow];
};

const queueCommand: Command = {
	cooldown: 5,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder().setName('queue').setDescription('Display and manage the music queue').setNameLocalizations(localizationManager.getCommandLocalizations('commands.queue.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.queue.description')).setContexts(discord.InteractionContextType.Guild),
	modal: async (interaction: discord.ModalSubmitInteraction): Promise<void> => {
		const acknowledged = await interaction
			.deferReply({ flags: discord.MessageFlags.Ephemeral })
			.then(() => true)
			.catch(() => false);
		if (!acknowledged) return interaction.client.logger.warn(`[QUEUE] Failed to defer modal ${interaction.customId}, interaction expired`);

		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(interaction.client);
		const answer = async (embed: discord.EmbedBuilder): Promise<void> => {
			await interaction.editReply({ embeds: [embed] }).catch((error) => interaction.client.logger.warn(`[QUEUE] Failed to answer modal ${interaction.customId}: ${error}`));
		};

		try {
			const player = interaction.client.manager.getPlayer(interaction.guild?.id || '');
			if (!player) return await answer(responseHandler.createErrorEmbed(t('responses.errors.no_player'), locale));

			const queueTracks = await player.queue.getTracks();
			if (queueTracks.length === 0) return await answer(responseHandler.createErrorEmbed(t('responses.queue.empty'), locale));

			const updateQueueDisplay = async (currentPage: number = 0) => {
				const updatedQueueTracks = await player.queue.getTracks();
				const totalPages = Math.ceil(updatedQueueTracks.length / 10) || 1;
				const adjustedPage = Math.min(currentPage, totalPages - 1);
				const isEmpty = updatedQueueTracks.length === 0;

				if (isEmpty) {
					const emptyEmbed = responseHandler.createInfoEmbed(t('responses.queue.empty'));
					await interaction.message?.edit({ embeds: [emptyEmbed], components: [] });
				} else {
					const updatedEmbed = await createQueueEmbed(player, updatedQueueTracks, adjustedPage, t, interaction.client);
					const updatedButtons = createQueueButtons(adjustedPage, totalPages, false, t, updatedQueueTracks.length);
					await interaction.message?.edit({ embeds: [updatedEmbed], components: updatedButtons });
				}
			};

			if (interaction.customId === 'queue-remove-modal') {
				const positionValue = interaction.fields.getTextInputValue('queue-position').trim();

				const handleRemove = async (positions: number[]): Promise<{ removed: number; total: number }> => {
					let removedCount = 0;
					const validPositions = [...new Set(positions.filter((pos) => pos >= 1 && pos <= queueTracks.length))].sort((a, b) => b - a);

					for (const pos of validPositions) {
						try {
							const [removed] = await player.queue.remove(pos - 1);
							if (!removed) {
								interaction.client.logger.warn(`[QUEUE] Nothing at position ${pos} to remove, queue changed`);
								continue;
							}
							removedCount++;
							interaction.client.logger.info(`[QUEUE] Successfully removed track at position ${pos}: ${removed.title}`);
						} catch (error) {
							interaction.client.logger.warn(`[QUEUE] Failed to remove position ${pos}: ${error}`);
						}
					}
					return { removed: removedCount, total: positions.length };
				};

				let result: { removed: number; total: number };

				if (positionValue.includes('-')) {
					const [start, end] = positionValue.split('-').map((s) => parseInt(s.trim()));
					if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > queueTracks.length) return await answer(responseHandler.createErrorEmbed(t('responses.queue.invalid_range'), locale));
					const positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
					result = await handleRemove(positions);
				} else if (positionValue.includes(',')) {
					const positions = positionValue
						.split(',')
						.map((s) => parseInt(s.trim()))
						.filter((n) => !isNaN(n));
					if (positions.length === 0) return await answer(responseHandler.createErrorEmbed(t('responses.queue.invalid_positions'), locale));
					result = await handleRemove(positions);
				} else {
					const position = parseInt(positionValue);
					if (isNaN(position) || position < 1 || position > queueTracks.length) return await answer(responseHandler.createErrorEmbed(t('responses.queue.invalid_position'), locale));
					result = await handleRemove([position]);
				}

				if (result.removed > 0) {
					await answer(responseHandler.createSuccessEmbed(t('responses.queue.removed', { count: result.removed })));
					await updateQueueDisplay();
				} else {
					await answer(responseHandler.createErrorEmbed(t('responses.queue.remove_failed'), locale));
				}
			} else if (interaction.customId === 'queue-move-modal') {
				const fromPosition = parseInt(interaction.fields.getTextInputValue('move-from').trim());
				const toPosition = parseInt(interaction.fields.getTextInputValue('move-to').trim());

				if (isNaN(fromPosition) || isNaN(toPosition) || fromPosition < 1 || toPosition < 1 || fromPosition > queueTracks.length || toPosition > queueTracks.length) return await answer(responseHandler.createErrorEmbed(t('responses.queue.invalid_move_positions'), locale));
				if (fromPosition === toPosition) return await answer(responseHandler.createInfoEmbed(t('responses.queue.same_position')));

				try {
					const trackToMove = queueTracks[fromPosition - 1];
					if (!trackToMove) return await answer(responseHandler.createErrorEmbed(t('responses.queue.track_not_found'), locale));

					const queueArray = await player.queue.getTracks();
					const trackIndex = queueArray.findIndex((t: magmastream.Track) => t.uri === trackToMove.uri && t.title === trackToMove.title);

					if (trackIndex !== -1) {
						await player.queue.remove(trackIndex);

						const adjustedToPosition = toPosition > fromPosition ? toPosition - 2 : toPosition - 1;
						const queueSize = await player.queue.size();
						const finalPosition = Math.max(0, Math.min(adjustedToPosition, queueSize));

						if (finalPosition >= queueSize) {
							await player.queue.add(trackToMove);
						} else {
							const newQueue = await player.queue.getTracks();
							newQueue.splice(finalPosition, 0, trackToMove);
							await player.queue.clear();
							for (const track of newQueue) {
								await player.queue.add(track);
							}
						}

						interaction.client.logger.info(`[QUEUE] Moved track "${trackToMove.title}" from position ${fromPosition} to position ${toPosition}`);
						await answer(responseHandler.createSuccessEmbed(t('responses.queue.moved', { track: trackToMove.title, from: fromPosition, to: toPosition })));
						await updateQueueDisplay();
					} else {
						await answer(responseHandler.createErrorEmbed(t('responses.queue.move_failed'), locale));
					}
				} catch (error) {
					interaction.client.logger.error(`[QUEUE] Move error: ${error}`);
					await answer(responseHandler.createErrorEmbed(t('responses.queue.move_failed'), locale));
				}
			} else {
				await answer(responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale));
			}
		} catch (error) {
			interaction.client.logger.error(`[QUEUE] Modal error: ${error}`);
			await answer(responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale));
		}
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.queue();
	},
};

export default queueCommand;
