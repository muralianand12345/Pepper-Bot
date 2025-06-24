"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../../../core/music");
const locales_1 = require("../../../core/locales");
const music_2 = require("../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const validateRadioButtonInteraction = (interaction) => {
    return interaction.isButton() && interaction.customId.startsWith('radio_');
};
const isInteractionExpired = (interaction) => {
    const now = Date.now();
    const interactionTime = interaction.createdTimestamp;
    const maxAge = 15 * 60 * 1000; // 15 minutes
    return now - interactionTime > maxAge;
};
const safeReply = async (interaction, options) => {
    try {
        if (isInteractionExpired(interaction)) {
            return false;
        }
        await interaction.reply(options);
        return true;
    }
    catch (error) {
        if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
            return false;
        }
        throw error;
    }
};
const safeFollowUp = async (interaction, options) => {
    try {
        if (isInteractionExpired(interaction)) {
            return false;
        }
        await interaction.followUp(options);
        return true;
    }
    catch (error) {
        if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
            return false;
        }
        throw error;
    }
};
const safeEditReply = async (interaction, options) => {
    try {
        if (isInteractionExpired(interaction)) {
            return false;
        }
        await interaction.editReply(options);
        return true;
    }
    catch (error) {
        if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
            return false;
        }
        throw error;
    }
};
const safeUpdate = async (interaction, options) => {
    try {
        if (isInteractionExpired(interaction)) {
            return false;
        }
        await interaction.update(options);
        return true;
    }
    catch (error) {
        if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
            return false;
        }
        throw error;
    }
};
const disableButtons = (components) => {
    return components.map((row) => {
        const newRow = new discord_js_1.default.ActionRowBuilder();
        row.components.forEach((button) => {
            const newButton = discord_js_1.default.ButtonBuilder.from(button.toJSON()).setDisabled(true);
            newRow.addComponents(newButton);
        });
        return newRow;
    });
};
const createDisabledComponents = (originalMessage) => {
    const components = [];
    originalMessage.components.forEach((row) => {
        if (row.type === discord_js_1.default.ComponentType.ActionRow) {
            const actionRow = new discord_js_1.default.ActionRowBuilder();
            row.components.forEach((component) => {
                if (component.type === discord_js_1.default.ComponentType.Button) {
                    const button = new discord_js_1.default.ButtonBuilder()
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
const handleRadioButtonAction = async (interaction, client) => {
    if (isInteractionExpired(interaction)) {
        client.logger.warn(`[RADIO_BUTTON] Interaction ${interaction.id} has expired`);
        return;
    }
    try {
        const locale = await localeDetector.detectLocale(interaction);
        const t = await localeDetector.getTranslator(interaction);
        const responseHandler = new music_2.MusicResponseHandler(client);
        if (interaction.customId.startsWith('radio_play_')) {
            const stationId = interaction.customId.replace('radio_play_', '');
            const replied = await safeReply(interaction, {
                content: '🔄 ' + t('responses.radio.loading_station'),
                flags: discord_js_1.default.MessageFlags.Ephemeral,
            });
            if (!replied) {
                client.logger.warn(`[RADIO_BUTTON] Could not reply to expired interaction ${interaction.id}`);
                return;
            }
            const radioManager = music_2.RadioManager.getInstance(client);
            const station = await radioManager.getStationById(stationId);
            if (!station) {
                await safeEditReply(interaction, {
                    content: '❌ ' + t('responses.radio.station_not_found'),
                    components: [],
                });
                return;
            }
            const music = new music_1.Music(client, interaction);
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
                    }
                    catch (editError) {
                        if (editError.code !== 10062) {
                            client.logger.warn(`[RADIO_BUTTON] Could not disable buttons: ${editError.message}`);
                        }
                    }
                }
            }
            catch (playError) {
                client.logger.error(`[RADIO_BUTTON] Error playing station: ${playError}`);
                await safeEditReply(interaction, {
                    content: '❌ ' + t('responses.radio.play_error', { station: station.name }),
                    components: [responseHandler.getSupportButton(locale)],
                });
            }
        }
    }
    catch (error) {
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
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                });
            }
            catch (localeError) {
                await safeReply(interaction, {
                    content: '❌ An error occurred while processing your request.',
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                });
            }
        }
    }
};
const event = {
    name: discord_js_1.default.Events.InteractionCreate,
    execute: async (interaction, client) => {
        if (!validateRadioButtonInteraction(interaction))
            return;
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
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                });
            }
            catch (localeError) {
                await safeReply(interaction, {
                    content: '❌ Music is currently disabled.',
                    flags: discord_js_1.default.MessageFlags.Ephemeral,
                });
            }
            return;
        }
        await handleRadioButtonAction(interaction, client);
    },
};
exports.default = event;
