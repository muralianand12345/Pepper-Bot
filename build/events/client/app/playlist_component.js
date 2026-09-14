"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const locales_1 = require("../../../core/locales");
const v2_1 = require("../../../utils/v2");
const music_1 = require("../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const event = {
    name: discord_js_1.default.Events.InteractionCreate,
    execute: async (interaction, client) => {
        if (!(0, music_1.isPlaylistComponent)(interaction))
            return;
        try {
            await new music_1.PlaylistComponentHandler(client, interaction).handle();
        }
        catch (error) {
            client.logger.error(`[PLAYLIST_COMPONENT] Error handling ${interaction.customId}: ${error}`);
            const t = await localeDetector.getTranslator(interaction).catch(() => null);
            const reply = (0, v2_1.v2Ephemeral)((0, v2_1.v2Text)(`❌ ${t ? t('responses.errors.general_error') : 'An error occurred while processing your request.'}`));
            if (interaction.deferred || interaction.replied)
                await interaction.followUp(reply).catch(() => { });
            else
                await interaction.reply(reply).catch(() => { });
        }
    },
};
exports.default = event;
