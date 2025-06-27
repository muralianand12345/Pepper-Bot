"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const types_1 = require("../types");
const music_2 = require("../core/music");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const queueCommand = {
    cooldown: 5,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder().setName('queue').setDescription('Display and manage the music queue').setNameLocalizations(localizationManager.getCommandLocalizations('commands.queue.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.queue.description')).setContexts(discord_js_1.default.InteractionContextType.Guild),
    modal: async (interaction) => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_2.MusicResponseHandler(interaction.client);
        try {
            const player = interaction.client.manager.get(interaction.guild?.id || '');
            if (!player) {
                await interaction.reply({
                    embeds: [responseHandler.createErrorEmbed(t('responses.errors.no_player'), locale)],
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                });
                return;
            }
            const queueTracks = Array.from(player.queue);
            if (queueTracks.length === 0) {
                await interaction.reply({
                    embeds: [responseHandler.createErrorEmbed(t('responses.queue.empty'), locale)],
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                });
                return;
            }
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
                    if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > queueTracks.length) {
                        await interaction.reply({
                            embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_range'), locale)],
                            flags: discord_js_1.default.MessageFlags.Ephemeral,
                        });
                        return;
                    }
                    const positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    result = handleRemove(positions);
                }
                else if (positionValue.includes(',')) {
                    const positions = positionValue
                        .split(',')
                        .map((s) => parseInt(s.trim()))
                        .filter((n) => !isNaN(n));
                    if (positions.length === 0) {
                        await interaction.reply({
                            embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_positions'), locale)],
                            flags: discord_js_1.default.MessageFlags.Ephemeral,
                        });
                        return;
                    }
                    result = handleRemove(positions);
                }
                else {
                    const position = parseInt(positionValue);
                    if (isNaN(position) || position < 1 || position > queueTracks.length) {
                        await interaction.reply({
                            embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_position'), locale)],
                            flags: discord_js_1.default.MessageFlags.Ephemeral,
                        });
                        return;
                    }
                    result = handleRemove([position]);
                }
                if (result.removed > 0) {
                    await interaction.reply({
                        embeds: [responseHandler.createSuccessEmbed(t('responses.queue.removed', { count: result.removed }), locale)],
                        flags: discord_js_1.default.MessageFlags.Ephemeral,
                    });
                }
                else {
                    await interaction.reply({
                        embeds: [responseHandler.createErrorEmbed(t('responses.queue.remove_failed'), locale)],
                        flags: discord_js_1.default.MessageFlags.Ephemeral,
                    });
                }
            }
            else if (interaction.customId === 'queue-move-modal') {
                const fromPosition = parseInt(interaction.fields.getTextInputValue('move-from').trim());
                const toPosition = parseInt(interaction.fields.getTextInputValue('move-to').trim());
                if (isNaN(fromPosition) || isNaN(toPosition) || fromPosition < 1 || toPosition < 1 || fromPosition > queueTracks.length || toPosition > queueTracks.length) {
                    await interaction.reply({
                        embeds: [responseHandler.createErrorEmbed(t('responses.queue.invalid_move_positions'), locale)],
                        flags: discord_js_1.default.MessageFlags.Ephemeral,
                    });
                    return;
                }
                if (fromPosition === toPosition) {
                    await interaction.reply({
                        embeds: [responseHandler.createInfoEmbed(t('responses.queue.same_position'), locale)],
                        flags: discord_js_1.default.MessageFlags.Ephemeral,
                    });
                    return;
                }
                try {
                    const trackToMove = queueTracks[fromPosition - 1];
                    if (!trackToMove) {
                        await interaction.reply({
                            embeds: [responseHandler.createErrorEmbed(t('responses.queue.track_not_found'), locale)],
                            flags: discord_js_1.default.MessageFlags.Ephemeral,
                        });
                        return;
                    }
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
                        await interaction.reply({
                            embeds: [responseHandler.createSuccessEmbed(t('responses.queue.moved', { track: trackToMove.title, from: fromPosition, to: toPosition }), locale)],
                            flags: discord_js_1.default.MessageFlags.Ephemeral,
                        });
                    }
                    else {
                        await interaction.reply({
                            embeds: [responseHandler.createErrorEmbed(t('responses.queue.move_failed'), locale)],
                            flags: discord_js_1.default.MessageFlags.Ephemeral,
                        });
                    }
                }
                catch (error) {
                    interaction.client.logger.error(`[QUEUE] Move error: ${error}`);
                    await interaction.reply({
                        embeds: [responseHandler.createErrorEmbed(t('responses.queue.move_failed'), locale)],
                        flags: discord_js_1.default.MessageFlags.Ephemeral,
                    });
                }
            }
        }
        catch (error) {
            interaction.client.logger.error(`[QUEUE] Modal error: ${error}`);
            if (!interaction.replied) {
                await interaction
                    .reply({
                    embeds: [responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale)],
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                })
                    .catch(() => { });
            }
        }
    },
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.queue();
    },
};
exports.default = queueCommand;
