import discord from 'discord.js';
import magmastream from 'magmastream';

import { Music } from '../core/music';
import Formatter from '../utils/format';
import { Command, CommandCategory } from '../types';
import { getRequester, MusicResponseHandler, ProgressBarUtils } from '../core/music';
import { LocalizationManager, LocaleDetector, TranslatorFunction } from '../core/locales';
import { v2, withRows, subtext, panel } from '../utils/v2';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

export const createQueueContainer = async (player: magmastream.Player, queueTracks: magmastream.Track[], currentPage: number, t: TranslatorFunction, client: discord.Client): Promise<discord.ContainerBuilder> => {
	const itemsPerPage = 10;
	const startIndex = currentPage * itemsPerPage;
	const queuePage = queueTracks.slice(startIndex, startIndex + itemsPerPage);
	const currentTrack = await player.queue.getCurrent();

	const summary = [`**${queueTracks.length}** ${t('responses.queue.tracks_in_queue')}`];
	const totalDuration = queueTracks.reduce((acc, track) => acc + (track?.isStream ? 0 : Math.max(0, Number(track?.duration || 0))), 0);
	const streamCount = queueTracks.filter((track) => track.isStream).length;
	if (totalDuration > 0) summary.push(`**${Formatter.msToTime(totalDuration)}** ${t('responses.queue.total_duration')}`);
	if (streamCount > 0) summary.push(`**${streamCount}** ${t('responses.queue.live_streams')}`);

	const container = panel(0x5865f2, {
		title: `🎵 ${t('responses.queue.title')}`,
		body: summary.join('\n'),
		thumbnail: currentTrack ? currentTrack.thumbnail || currentTrack.artworkUrl || null : null,
	});

	if (currentTrack) {
		const currentTitle = Formatter.truncateText(currentTrack.title || 'Unknown', 40);
		const currentArtist = Formatter.truncateText(currentTrack.author || 'Unknown', 25);
		const durationMs = Number(currentTrack.duration || 0);
		const currentDuration = currentTrack.isStream ? t('responses.queue.live') : durationMs > 0 ? Formatter.msToTime(durationMs) : '00:00:00';
		const progress = player.playing ? ProgressBarUtils.createBarFromPlayer(player, durationMs) : null;

		const nowPlaying = [`**🎵 ${t('responses.queue.now_playing')}**`, `**${currentTitle}** - ${currentArtist}`, `└ ${currentDuration}`];
		if (progress) nowPlaying.push('', `**⏱️ ${t('responses.queue.progress')}**`, progress.bar, `\`${progress.formattedPosition} / ${progress.formattedDuration}\``);

		container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(nowPlaying.join('\n')));
	}

	if (queuePage.length > 0) {
		const queueList = queuePage
			.map((track, index) => {
				const position = startIndex + index + 1;
				const title = Formatter.truncateText((track?.title as string) || 'Unknown', 35);
				const artist = Formatter.truncateText((track?.author as string) || 'Unknown', 20);
				const durationMs = Number(track?.duration || 0);
				const duration = track?.isStream ? t('responses.queue.live') : durationMs > 0 ? Formatter.msToTime(durationMs) : '00:00:00';
				const requesterData = track?.requester ? getRequester(client, track.requester) : null;
				const requester = requesterData ? ` • ${requesterData.username}` : '';
				return `**${position}.** **${title}** - ${artist}\n└ ${duration}${requester}`;
			})
			.join('\n\n');

		container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`**📋 ${t('responses.queue.upcoming')} (${queueTracks.length})**\n${queueList.length > 1500 ? queueList.substring(0, 1497) + '...' : queueList}`));
	}

	const pageLabel = queueTracks.length > 0 ? `${t('responses.queue.page')} ${currentPage + 1}/${Math.ceil(queueTracks.length / itemsPerPage)} • ${client.user?.username || 'Music Bot'}` : `${client.user?.username || 'Music Bot'}`;
	container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(subtext(pageLabel)));
	return container;
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
		const answer = async (container: discord.ContainerBuilder): Promise<void> => {
			await interaction.editReply(v2(container)).catch((error) => interaction.client.logger.warn(`[QUEUE] Failed to answer modal ${interaction.customId}: ${error}`));
		};

		try {
			const player = interaction.client.manager.getPlayer(interaction.guild?.id || '');
			if (!player) return await answer(responseHandler.createErrorContainer(t('responses.errors.no_player'), locale));

			const queueTracks = await player.queue.getTracks();
			if (queueTracks.length === 0) return await answer(responseHandler.createErrorContainer(t('responses.queue.empty'), locale));

			const updateQueueDisplay = async (currentPage: number = 0) => {
				const updatedQueueTracks = await player.queue.getTracks();
				const totalPages = Math.ceil(updatedQueueTracks.length / 10) || 1;
				const adjustedPage = Math.min(currentPage, totalPages - 1);
				const isEmpty = updatedQueueTracks.length === 0;

				if (isEmpty) {
					await interaction.message?.edit(v2(responseHandler.createInfoContainer(t('responses.queue.empty'))));
				} else {
					const updatedContainer = await createQueueContainer(player, updatedQueueTracks, adjustedPage, t, interaction.client);
					const updatedButtons = createQueueButtons(adjustedPage, totalPages, false, t, updatedQueueTracks.length);
					await interaction.message?.edit(v2(withRows(updatedContainer, ...updatedButtons)));
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
					if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > queueTracks.length) return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_range'), locale));
					const positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
					result = await handleRemove(positions);
				} else if (positionValue.includes(',')) {
					const positions = positionValue
						.split(',')
						.map((s) => parseInt(s.trim()))
						.filter((n) => !isNaN(n));
					if (positions.length === 0) return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_positions'), locale));
					result = await handleRemove(positions);
				} else {
					const position = parseInt(positionValue);
					if (isNaN(position) || position < 1 || position > queueTracks.length) return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_position'), locale));
					result = await handleRemove([position]);
				}

				if (result.removed > 0) {
					await answer(responseHandler.createSuccessContainer(t('responses.queue.removed', { count: result.removed })));
					await updateQueueDisplay();
				} else {
					await answer(responseHandler.createErrorContainer(t('responses.queue.remove_failed'), locale));
				}
			} else if (interaction.customId === 'queue-move-modal') {
				const fromPosition = parseInt(interaction.fields.getTextInputValue('move-from').trim());
				const toPosition = parseInt(interaction.fields.getTextInputValue('move-to').trim());

				if (isNaN(fromPosition) || isNaN(toPosition) || fromPosition < 1 || toPosition < 1 || fromPosition > queueTracks.length || toPosition > queueTracks.length) return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_move_positions'), locale));
				if (fromPosition === toPosition) return await answer(responseHandler.createInfoContainer(t('responses.queue.same_position')));

				try {
					const trackToMove = queueTracks[fromPosition - 1];
					if (!trackToMove) return await answer(responseHandler.createErrorContainer(t('responses.queue.track_not_found'), locale));

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
						await answer(responseHandler.createSuccessContainer(t('responses.queue.moved', { track: trackToMove.title, from: fromPosition, to: toPosition })));
						await updateQueueDisplay();
					} else {
						await answer(responseHandler.createErrorContainer(t('responses.queue.move_failed'), locale));
					}
				} catch (error) {
					interaction.client.logger.error(`[QUEUE] Move error: ${error}`);
					await answer(responseHandler.createErrorContainer(t('responses.queue.move_failed'), locale));
				}
			} else {
				await answer(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale));
			}
		} catch (error) {
			interaction.client.logger.error(`[QUEUE] Modal error: ${error}`);
			await answer(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale));
		}
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.queue();
	},
};

export default queueCommand;
