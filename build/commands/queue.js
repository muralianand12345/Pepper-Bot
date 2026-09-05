"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueueContainer = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const format_1 = __importDefault(require("../utils/format"));
const types_1 = require("../types");
const music_2 = require("../core/music");
const locales_1 = require("../core/locales");
const v2_1 = require("../utils/v2");
const localeDetector = new locales_1.LocaleDetector();
const localizationManager = locales_1.LocalizationManager.getInstance();
const createQueueContainer = async (player, queueTracks, currentPage, t, client) => {
    const itemsPerPage = 10;
    const startIndex = currentPage * itemsPerPage;
    const queuePage = queueTracks.slice(startIndex, startIndex + itemsPerPage);
    const currentTrack = await player.queue.getCurrent();
    const summary = [`**${queueTracks.length}** ${t('responses.queue.tracks_in_queue')}`];
    const totalDuration = queueTracks.reduce((acc, track) => acc + (track?.isStream ? 0 : Math.max(0, Number(track?.duration || 0))), 0);
    const streamCount = queueTracks.filter((track) => track.isStream).length;
    if (totalDuration > 0)
        summary.push(`**${format_1.default.msToTime(totalDuration)}** ${t('responses.queue.total_duration')}`);
    if (streamCount > 0)
        summary.push(`**${streamCount}** ${t('responses.queue.live_streams')}`);
    const container = (0, v2_1.panel)(0x5865f2, {
        title: `🎵 ${t('responses.queue.title')}`,
        body: summary.join('\n'),
        thumbnail: currentTrack ? currentTrack.thumbnail || currentTrack.artworkUrl || null : null,
    });
    if (currentTrack) {
        const currentTitle = format_1.default.truncateText(currentTrack.title || 'Unknown', 40);
        const currentArtist = format_1.default.truncateText(currentTrack.author || 'Unknown', 25);
        const durationMs = Number(currentTrack.duration || 0);
        const currentDuration = currentTrack.isStream ? t('responses.queue.live') : durationMs > 0 ? format_1.default.msToTime(durationMs) : '00:00:00';
        const progress = player.playing ? music_2.ProgressBarUtils.createBarFromPlayer(player, durationMs) : null;
        const nowPlaying = [`**🎵 ${t('responses.queue.now_playing')}**`, `**${currentTitle}** - ${currentArtist}`, `└ ${currentDuration}`];
        if (progress)
            nowPlaying.push('', `**⏱️ ${t('responses.queue.progress')}**`, progress.bar, `\`${progress.formattedPosition} / ${progress.formattedDuration}\``);
        container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(nowPlaying.join('\n')));
    }
    if (queuePage.length > 0) {
        const queueList = queuePage
            .map((track, index) => {
            const position = startIndex + index + 1;
            const title = format_1.default.truncateText(track?.title || 'Unknown', 35);
            const artist = format_1.default.truncateText(track?.author || 'Unknown', 20);
            const durationMs = Number(track?.duration || 0);
            const duration = track?.isStream ? t('responses.queue.live') : durationMs > 0 ? format_1.default.msToTime(durationMs) : '00:00:00';
            const requesterData = track?.requester ? (0, music_2.getRequester)(client, track.requester) : null;
            const requester = requesterData ? ` • ${requesterData.username}` : '';
            return `**${position}.** **${title}** - ${artist}\n└ ${duration}${requester}`;
        })
            .join('\n\n');
        container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`**📋 ${t('responses.queue.upcoming')} (${queueTracks.length})**\n${queueList.length > 1500 ? queueList.substring(0, 1497) + '...' : queueList}`));
    }
    const pageLabel = queueTracks.length > 0 ? `${t('responses.queue.page')} ${currentPage + 1}/${Math.ceil(queueTracks.length / itemsPerPage)} • ${client.user?.username || 'Music Bot'}` : `${client.user?.username || 'Music Bot'}`;
    container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent((0, v2_1.subtext)(pageLabel)));
    return container;
};
exports.createQueueContainer = createQueueContainer;
const createQueueButtons = (page, totalPages, isEmpty, t, queueLength = 0) => {
    const navigationRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder()
        .setCustomId('queue-previous')
        .setLabel(t('responses.queue.buttons.previous'))
        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
        .setEmoji('⬅️')
        .setDisabled(page === 0 || isEmpty), new discord_js_1.default.ButtonBuilder()
        .setCustomId('queue-next')
        .setLabel(t('responses.queue.buttons.next'))
        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
        .setEmoji('➡️')
        .setDisabled(page >= totalPages - 1 || isEmpty), new discord_js_1.default.ButtonBuilder()
        .setCustomId('queue-shuffle')
        .setLabel(t('responses.queue.buttons.shuffle'))
        .setStyle(discord_js_1.default.ButtonStyle.Primary)
        .setEmoji('🔀')
        .setDisabled(isEmpty || queueLength < 2), new discord_js_1.default.ButtonBuilder()
        .setCustomId('queue-move')
        .setLabel(t('responses.queue.buttons.move'))
        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
        .setEmoji('🔄')
        .setDisabled(isEmpty || queueLength < 2));
    const actionRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('queue-remove').setLabel(t('responses.queue.buttons.remove')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('➖').setDisabled(isEmpty), new discord_js_1.default.ButtonBuilder().setCustomId('queue-clear').setLabel(t('responses.queue.buttons.clear')).setStyle(discord_js_1.default.ButtonStyle.Danger).setEmoji('🗑️').setDisabled(isEmpty));
    return [navigationRow, actionRow];
};
const queueCommand = {
    cooldown: 5,
    dj: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder().setName('queue').setDescription('Display and manage the music queue').setNameLocalizations(localizationManager.getCommandLocalizations('commands.queue.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.queue.description')).setContexts(discord_js_1.default.InteractionContextType.Guild),
    modal: async (interaction) => {
        const acknowledged = await interaction
            .deferReply({ flags: discord_js_1.default.MessageFlags.Ephemeral })
            .then(() => true)
            .catch(() => false);
        if (!acknowledged)
            return interaction.client.logger.warn(`[QUEUE] Failed to defer modal ${interaction.customId}, interaction expired`);
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_2.MusicResponseHandler(interaction.client);
        const answer = async (container) => {
            await interaction.editReply((0, v2_1.v2)(container)).catch((error) => interaction.client.logger.warn(`[QUEUE] Failed to answer modal ${interaction.customId}: ${error}`));
        };
        try {
            const player = interaction.client.manager.getPlayer(interaction.guild?.id || '');
            if (!player)
                return await answer(responseHandler.createErrorContainer(t('responses.errors.no_player'), locale));
            const queueTracks = await player.queue.getTracks();
            if (queueTracks.length === 0)
                return await answer(responseHandler.createErrorContainer(t('responses.queue.empty'), locale));
            const updateQueueDisplay = async (currentPage = 0) => {
                const updatedQueueTracks = await player.queue.getTracks();
                const totalPages = Math.ceil(updatedQueueTracks.length / 10) || 1;
                const adjustedPage = Math.min(currentPage, totalPages - 1);
                const isEmpty = updatedQueueTracks.length === 0;
                if (isEmpty) {
                    await interaction.message?.edit((0, v2_1.v2)(responseHandler.createInfoContainer(t('responses.queue.empty'))));
                }
                else {
                    const updatedContainer = await (0, exports.createQueueContainer)(player, updatedQueueTracks, adjustedPage, t, interaction.client);
                    const updatedButtons = createQueueButtons(adjustedPage, totalPages, false, t, updatedQueueTracks.length);
                    await interaction.message?.edit((0, v2_1.v2)((0, v2_1.withRows)(updatedContainer, ...updatedButtons)));
                }
            };
            if (interaction.customId === 'queue-remove-modal') {
                const positionValue = interaction.fields.getTextInputValue('queue-position').trim();
                const handleRemove = async (positions) => {
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
                        }
                        catch (error) {
                            interaction.client.logger.warn(`[QUEUE] Failed to remove position ${pos}: ${error}`);
                        }
                    }
                    return { removed: removedCount, total: positions.length };
                };
                let result;
                if (positionValue.includes('-')) {
                    const [start, end] = positionValue.split('-').map((s) => parseInt(s.trim()));
                    if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > queueTracks.length)
                        return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_range'), locale));
                    const positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    result = await handleRemove(positions);
                }
                else if (positionValue.includes(',')) {
                    const positions = positionValue
                        .split(',')
                        .map((s) => parseInt(s.trim()))
                        .filter((n) => !isNaN(n));
                    if (positions.length === 0)
                        return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_positions'), locale));
                    result = await handleRemove(positions);
                }
                else {
                    const position = parseInt(positionValue);
                    if (isNaN(position) || position < 1 || position > queueTracks.length)
                        return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_position'), locale));
                    result = await handleRemove([position]);
                }
                if (result.removed > 0) {
                    await answer(responseHandler.createSuccessContainer(t('responses.queue.removed', { count: result.removed })));
                    await updateQueueDisplay();
                }
                else {
                    await answer(responseHandler.createErrorContainer(t('responses.queue.remove_failed'), locale));
                }
            }
            else if (interaction.customId === 'queue-move-modal') {
                const fromPosition = parseInt(interaction.fields.getTextInputValue('move-from').trim());
                const toPosition = parseInt(interaction.fields.getTextInputValue('move-to').trim());
                if (isNaN(fromPosition) || isNaN(toPosition) || fromPosition < 1 || toPosition < 1 || fromPosition > queueTracks.length || toPosition > queueTracks.length)
                    return await answer(responseHandler.createErrorContainer(t('responses.queue.invalid_move_positions'), locale));
                if (fromPosition === toPosition)
                    return await answer(responseHandler.createInfoContainer(t('responses.queue.same_position')));
                try {
                    const trackToMove = queueTracks[fromPosition - 1];
                    if (!trackToMove)
                        return await answer(responseHandler.createErrorContainer(t('responses.queue.track_not_found'), locale));
                    const queueArray = await player.queue.getTracks();
                    const trackIndex = queueArray.findIndex((t) => t.uri === trackToMove.uri && t.title === trackToMove.title);
                    if (trackIndex !== -1) {
                        await player.queue.remove(trackIndex);
                        const adjustedToPosition = toPosition > fromPosition ? toPosition - 2 : toPosition - 1;
                        const queueSize = await player.queue.size();
                        const finalPosition = Math.max(0, Math.min(adjustedToPosition, queueSize));
                        if (finalPosition >= queueSize) {
                            await player.queue.add(trackToMove);
                        }
                        else {
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
                    }
                    else {
                        await answer(responseHandler.createErrorContainer(t('responses.queue.move_failed'), locale));
                    }
                }
                catch (error) {
                    interaction.client.logger.error(`[QUEUE] Move error: ${error}`);
                    await answer(responseHandler.createErrorContainer(t('responses.queue.move_failed'), locale));
                }
            }
            else {
                await answer(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale));
            }
        }
        catch (error) {
            interaction.client.logger.error(`[QUEUE] Modal error: ${error}`);
            await answer(responseHandler.createErrorContainer(t('responses.errors.general_error'), locale));
        }
    },
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.queue();
    },
};
exports.default = queueCommand;
