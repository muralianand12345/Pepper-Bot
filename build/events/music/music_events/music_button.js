"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../../../core/music");
const locales_1 = require("../../../core/locales");
const MUSIC_BUTTON_IDS = ['pause-music', 'resume-music', 'skip-music', 'stop-music', 'loop-music', 'activity-check-continue'];
const localeDetector = new locales_1.LocaleDetector();
const validateButtonInteraction = (interaction) => {
    return interaction.isButton() && MUSIC_BUTTON_IDS.includes(interaction.customId);
};
const handleMusicButtonAction = async (interaction, client) => {
    try {
        if (interaction.customId === 'activity-check-continue') {
            await handleActivityCheckContinue(interaction, client);
            return;
        }
        const music = new music_1.Music(client, interaction);
        const nowPlayingManager = interaction.guildId ? music_1.NowPlayingManager.getInstance(interaction.guildId, client.manager.getPlayer(interaction.guildId), client) : null;
        switch (interaction.customId) {
            case 'pause-music':
                await music.pause();
                if (nowPlayingManager)
                    nowPlayingManager.onPause();
                break;
            case 'resume-music':
                await music.resume();
                if (nowPlayingManager)
                    nowPlayingManager.onResume();
                break;
            case 'skip-music':
                await music.skip();
                break;
            case 'stop-music':
                await music.stop();
                if (nowPlayingManager)
                    nowPlayingManager.onStop();
                break;
            case 'loop-music':
                await music.loop();
                break;
            default:
                client.logger.warn(`[MUSIC_BUTTON] Unknown button interaction: ${interaction.customId}`);
                break;
        }
    }
    catch (error) {
        client.logger.error(`[MUSIC_BUTTON] Error handling button ${interaction.customId}: ${error}`);
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
const handleActivityCheckContinue = async (interaction, client) => {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ This button can only be used in a server.', flags: discord_js_1.default.MessageFlags.Ephemeral });
        return;
    }
    const player = client.manager.getPlayer(guildId);
    if (!player) {
        await interaction.reply({ content: '❌ No active music player found.', flags: discord_js_1.default.MessageFlags.Ephemeral });
        return;
    }
    if (!music_1.ActivityCheckManager.hasInstance(guildId)) {
        await interaction.reply({ content: '❌ No activity check is pending.', flags: discord_js_1.default.MessageFlags.Ephemeral });
        return;
    }
    const activityCheckManager = music_1.ActivityCheckManager.getInstance(guildId, player, client);
    if (!activityCheckManager.isPending()) {
        await interaction.reply({ content: '❌ This activity check has already been handled.', flags: discord_js_1.default.MessageFlags.Ephemeral });
        return;
    }
    await interaction.deferUpdate();
    await activityCheckManager.onContinueConfirmed();
    client.logger.info(`[MUSIC_BUTTON] Activity check confirmed by user ${interaction.user.id} in guild ${guildId}`);
};
const event = {
    name: discord_js_1.default.Events.InteractionCreate,
    execute: async (interaction, client) => {
        if (!validateButtonInteraction(interaction))
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
        await handleMusicButtonAction(interaction, client);
    },
};
exports.default = event;
