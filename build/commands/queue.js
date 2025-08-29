"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const types_1 = require("../types");
const music_2 = require("../core/music");
const format_1 = __importDefault(require("../utils/format"));
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const createQueueEmbed = (player, queueTracks, currentPage, t, client) => {
    const itemsPerPage = 10;
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const queuePage = queueTracks.slice(startIndex, endIndex);
    const currentTrack = player.queue.current;
    const embed = new discord_js_1.default.EmbedBuilder()
        .setColor('#5865f2')
        .setTitle(`🎵 ${t('responses.queue.title')}`)
        .setTimestamp()
        .setFooter({
        text: queueTracks.length > 0 ? `${t('responses.queue.page')} ${currentPage + 1}/${Math.ceil(queueTracks.length / itemsPerPage)} • ${client.user?.username || 'Music Bot'}` : `${client.user?.username || 'Music Bot'}`,
        iconURL: client.user?.displayAvatarURL(),
    });
    if (currentTrack) {
        const currentTitle = format_1.default.truncateText(currentTrack.title, 40);
        const currentArtist = format_1.default.truncateText(currentTrack.author, 25);
        const currentDuration = currentTrack.isStream ? t('responses.queue.live') : format_1.default.msToTime(currentTrack.duration);
        const progressBar = player.playing ? format_1.default.createProgressBar(player) : '';
        embed.addFields({ name: `🎵 ${t('responses.queue.now_playing')}`, value: `**${currentTitle}** - ${currentArtist}\n└ ${currentDuration}`, inline: false });
        if (progressBar)
            embed.addFields({ name: `⏱️ ${t('responses.queue.progress')}`, value: progressBar, inline: false });
    }
    if (queuePage.length > 0) {
        const queueList = queuePage
            .map((track, index) => {
            const position = startIndex + index + 1;
            const title = format_1.default.truncateText(track.title, 35);
            const artist = format_1.default.truncateText(track.author, 20);
            const duration = track.isStream ? t('responses.queue.live') : format_1.default.msToTime(track.duration);
            const requester = track.requester ? ` • ${track.requester.username}` : '';
            return `**${position}.** **${title}** - ${artist}\n└ ${duration}${requester}`;
        })
            .join('\n\n');
        embed.addFields({ name: `📋 ${t('responses.queue.upcoming')} (${queueTracks.length})`, value: queueList.length > 1024 ? queueList.substring(0, 1021) + '...' : queueList, inline: false });
    }
    const totalDuration = queueTracks.reduce((acc, track) => acc + (track.isStream ? 0 : track.duration), 0);
    const totalFormatted = format_1.default.msToTime(totalDuration);
    const streamCount = queueTracks.filter((track) => track.isStream).length;
    let description = `**${queueTracks.length}** ${t('responses.queue.tracks_in_queue')}`;
    if (totalDuration > 0)
        description += `\n**${totalFormatted}** ${t('responses.queue.total_duration')}`;
    if (streamCount > 0)
        description += `\n**${streamCount}** ${t('responses.queue.live_streams')}`;
    embed.setDescription(description);
    if (currentTrack && (currentTrack.thumbnail || currentTrack.artworkUrl))
        embed.setThumbnail(currentTrack.thumbnail || currentTrack.artworkUrl);
    return embed;
};
const createQueueButtons = (page, totalPages, isEmpty, t) => {
    const queueTracks = Array.from({ length: totalPages * 10 });
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
        .setDisabled(isEmpty || queueTracks.length < 2), new discord_js_1.default.ButtonBuilder()
        .setCustomId('queue-move')
        .setLabel(t('responses.queue.buttons.move'))
        .setStyle(discord_js_1.default.ButtonStyle.Secondary)
        .setEmoji('🔄')
        .setDisabled(isEmpty || queueTracks.length < 2));
    const actionRow = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setCustomId('queue-remove').setLabel(t('responses.queue.buttons.remove')).setStyle(discord_js_1.default.ButtonStyle.Secondary).setEmoji('➖').setDisabled(isEmpty), new discord_js_1.default.ButtonBuilder().setCustomId('queue-clear').setLabel(t('responses.queue.buttons.clear')).setStyle(discord_js_1.default.ButtonStyle.Danger).setEmoji('🗑️').setDisabled(isEmpty));
    return [navigationRow, actionRow];
};
const queueCommand = {
    cooldown: 5,
    dj: true,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder().setName('queue').setDescription('Display and manage the music queue').setNameLocalizations(localizationManager.getCommandLocalizations('commands.queue.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.queue.description')).setContexts(discord_js_1.default.InteractionContextType.Guild),
    modal: async (interaction) => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_2.MusicResponseHandler(interaction.client);
        try {
            const player = interaction.client.manager.get(interaction.guild?.id || '');
            if (!player)
                return await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.errors.no_player'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            const queueTracks = Array.from(player.queue);
            if (queueTracks.length === 0)
                return await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.empty'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            const updateQueueDisplay = async (currentPage = 0) => {
                const updatedQueueTracks = Array.from(player.queue);
                const totalPages = Math.ceil(updatedQueueTracks.length / 10) || 1;
                const adjustedPage = Math.min(currentPage, totalPages - 1);
                const isEmpty = updatedQueueTracks.length === 0;
                if (isEmpty) {
                    const emptyEmbed = responseHandler.createInfoEmbed(t('responses.queue.empty'), locale);
                    await interaction.message?.edit({ embeds: [emptyEmbed], components: [] });
                }
                else {
                    const updatedEmbed = createQueueEmbed(player, updatedQueueTracks, adjustedPage, t, interaction.client);
                    const updatedButtons = createQueueButtons(adjustedPage, totalPages, false, t);
                    await interaction.message?.edit({ embeds: [updatedEmbed], components: updatedButtons });
                }
            };
            if (interaction.customId === 'queue-remove-modal') {
                const positionValue = interaction.fields.getTextInputValue('queue-position').trim();
                const handleRemove = (positions) => {
                    let removedCount = 0;
                    const validPositions = positions.filter((pos) => pos >= 1 && pos <= queueTracks.length).sort((a, b) => b - a);
                    for (const pos of validPositions) {
                        try {
                            const track = queueTracks[pos - 1];
                            if (track) {
                                const queueArray = Array.from(player.queue);
                                const index = queueArray.findIndex((t) => t.uri === track.uri && t.title === track.title);
                                if (index !== -1) {
                                    player.queue.remove(index);
                                    removedCount++;
                                    interaction.client.logger.info(`[QUEUE] Successfully removed track at position ${pos}: ${track.title}`);
                                }
                            }
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
                        return await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_range'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                    const positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    result = handleRemove(positions);
                }
                else if (positionValue.includes(',')) {
                    const positions = positionValue
                        .split(',')
                        .map((s) => parseInt(s.trim()))
                        .filter((n) => !isNaN(n));
                    if (positions.length === 0)
                        return await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_positions'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                    result = handleRemove(positions);
                }
                else {
                    const position = parseInt(positionValue);
                    if (isNaN(position) || position < 1 || position > queueTracks.length)
                        return await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_position'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                    result = handleRemove([position]);
                }
                if (result.removed > 0) {
                    await interaction.reply({ embeds: [responseHandler.createSuccessEmbed(t('responses.queue.removed', { count: result.removed }), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                    await updateQueueDisplay();
                }
                else {
                    await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.remove_failed'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                }
            }
            else if (interaction.customId === 'queue-move-modal') {
                const fromPosition = parseInt(interaction.fields.getTextInputValue('move-from').trim());
                const toPosition = parseInt(interaction.fields.getTextInputValue('move-to').trim());
                if (isNaN(fromPosition) || isNaN(toPosition) || fromPosition < 1 || toPosition < 1 || fromPosition > queueTracks.length || toPosition > queueTracks.length)
                    return await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_move_positions'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                if (fromPosition === toPosition)
                    return await interaction.reply({ embeds: [responseHandler.createInfoEmbed(t('responses.queue.same_position'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                try {
                    const trackToMove = queueTracks[fromPosition - 1];
                    if (!trackToMove)
                        return await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.track_not_found'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                    const queueArray = Array.from(player.queue);
                    const trackIndex = queueArray.findIndex((t) => t.uri === trackToMove.uri && t.title === trackToMove.title);
                    if (trackIndex !== -1) {
                        player.queue.remove(trackIndex);
                        const adjustedToPosition = toPosition > fromPosition ? toPosition - 2 : toPosition - 1;
                        const finalPosition = Math.max(0, Math.min(adjustedToPosition, player.queue.size));
                        if (finalPosition >= player.queue.size) {
                            player.queue.add(trackToMove);
                        }
                        else {
                            const newQueue = Array.from(player.queue);
                            newQueue.splice(finalPosition, 0, trackToMove);
                            player.queue.clear();
                            newQueue.forEach((track) => player.queue.add(track));
                        }
                        interaction.client.logger.info(`[QUEUE] Moved track "${trackToMove.title}" from position ${fromPosition} to position ${toPosition}`);
                        await interaction.reply({ embeds: [responseHandler.createSuccessEmbed(t('responses.queue.moved', { track: trackToMove.title, from: fromPosition, to: toPosition }), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                        await updateQueueDisplay();
                    }
                    else {
                        await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.move_failed'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                    }
                }
                catch (error) {
                    interaction.client.logger.error(`[QUEUE] Move error: ${error}`);
                    await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.queue.move_failed'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                }
            }
        }
        catch (error) {
            interaction.client.logger.error(`[QUEUE] Modal error: ${error}`);
            if (!interaction.replied)
                await interaction.reply({ embeds: [responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral }).catch(() => { });
        }
    },
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.queue();
    },
};
exports.default = queueCommand;
