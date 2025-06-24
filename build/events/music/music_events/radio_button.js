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
const handleRadioButtonAction = async (interaction, client) => {
    try {
        const locale = await localeDetector.detectLocale(interaction);
        const t = await localeDetector.getTranslator(interaction);
        const responseHandler = new music_2.MusicResponseHandler(client);
        if (interaction.customId.startsWith('radio_play_')) {
            const stationId = interaction.customId.replace('radio_play_', '');
            await interaction.deferUpdate();
            const radioManager = music_2.RadioManager.getInstance(client);
            const station = await radioManager.getStationById(stationId);
            if (!station)
                return await interaction.followUp({ embeds: [responseHandler.createErrorEmbed(t('responses.radio.station_not_found'), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            const music = new music_1.Music(client, interaction);
            try {
                await music.playRadio(station);
                await interaction.followUp({ embeds: [responseHandler.createSuccessEmbed(t('responses.radio.playing_station', { station: station.name }), locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
                const updatedComponents = interaction.message.components.map((row) => {
                    const actionRow = new discord_js_1.default.ActionRowBuilder();
                    if (row.type === discord_js_1.default.ComponentType.ActionRow) {
                        row.components.forEach((component) => {
                            if (component.type === discord_js_1.default.ComponentType.Button) {
                                const button = new discord_js_1.default.ButtonBuilder()
                                    .setCustomId(component.customId || 'disabled')
                                    .setLabel(component.label || 'Disabled')
                                    .setStyle(component.style)
                                    .setDisabled(true);
                                if (component.emoji)
                                    button.setEmoji(component.emoji);
                                actionRow.addComponents(button);
                            }
                        });
                    }
                    return actionRow;
                });
                await interaction.editReply({ components: updatedComponents });
            }
            catch (error) {
                client.logger.error(`[RADIO_BUTTON] Error playing station: ${error}`);
                await interaction.followUp({ embeds: [responseHandler.createErrorEmbed(t('responses.radio.play_error', { station: station.name }), locale, true)], components: [responseHandler.getSupportButton(locale)], flags: discord_js_1.default.MessageFlags.Ephemeral });
            }
        }
    }
    catch (error) {
        client.logger.error(`[RADIO_BUTTON] Error handling button ${interaction.customId}: ${error}`);
        if (!interaction.replied && !interaction.deferred) {
            try {
                const t = await localeDetector.getTranslator(interaction);
                const message = t('responses.errors.general_error');
                await interaction.reply({ content: `❌ ${message}`, flags: discord_js_1.default.MessageFlags.Ephemeral }).catch(() => { });
            }
            catch (localeError) {
                await interaction.reply({ content: '❌ An error occurred while processing your request.', flags: discord_js_1.default.MessageFlags.Ephemeral }).catch(() => { });
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
            try {
                const t = await localeDetector.getTranslator(interaction);
                const message = t('responses.errors.music_disabled');
                await interaction.reply({ content: `❌ ${message}`, flags: discord_js_1.default.MessageFlags.Ephemeral }).catch(() => { });
            }
            catch (localeError) {
                await interaction.reply({ content: '❌ Music is currently disabled.', flags: discord_js_1.default.MessageFlags.Ephemeral }).catch(() => { });
            }
            return;
        }
        await handleRadioButtonAction(interaction, client);
    },
};
exports.default = event;
