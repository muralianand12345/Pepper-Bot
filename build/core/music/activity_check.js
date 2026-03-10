"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityCheckManager = void 0;
const msg_1 = require("../../utils/msg");
const locales_1 = require("../locales");
const handlers_1 = require("./handlers");
const music_guild_1 = __importDefault(require("../../events/database/schema/music_guild"));
const ACTIVITY_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const RESPONSE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
class ActivityCheckManager {
    constructor(player, client) {
        this.checkTimer = null;
        this.responseTimer = null;
        this.destroyed = false;
        this.activeMessage = null;
        this.isPendingResponse = false;
        this.resetSession = () => {
            this.sessionStartTime = Date.now();
            this.isPendingResponse = false;
            this.clearResponseTimer();
            this.startCheckTimer();
            this.client.logger?.debug(`[ActivityCheckManager] Session reset for guild ${this.player.guildId}`);
        };
        this.onContinueConfirmed = async () => {
            this.isPendingResponse = false;
            this.clearResponseTimer();
            this.resetSession();
            if (this.activeMessage) {
                try {
                    const locale = await this.getGuildLocale();
                    const responseHandler = new handlers_1.MusicResponseHandler(this.client);
                    const embed = responseHandler.createActivityCheckConfirmedEmbed(locale);
                    const disabledButton = responseHandler.getActivityCheckButton(true, locale);
                    await this.activeMessage.edit({ embeds: [embed], components: [disabledButton] });
                }
                catch (error) {
                    this.client.logger?.warn(`[ActivityCheckManager] Failed to update confirmed message: ${error}`);
                }
                this.activeMessage = null;
            }
            this.client.logger?.info(`[ActivityCheckManager] User confirmed activity for guild ${this.player.guildId}`);
        };
        this.isPending = () => {
            return this.isPendingResponse;
        };
        this.destroy = () => {
            this.destroyed = true;
            this.clearCheckTimer();
            this.clearResponseTimer();
            this.activeMessage = null;
            this.client.logger?.debug(`[ActivityCheckManager] Destroyed for guild ${this.player.guildId}`);
        };
        this.startCheckTimer = () => {
            this.clearCheckTimer();
            if (this.destroyed)
                return;
            this.checkTimer = setTimeout(async () => {
                if (this.destroyed)
                    return;
                await this.sendActivityCheck();
            }, ACTIVITY_CHECK_INTERVAL);
            this.client.logger?.debug(`[ActivityCheckManager] Check timer started for guild ${this.player.guildId}, will trigger in 6 hours`);
        };
        this.clearCheckTimer = () => {
            if (this.checkTimer) {
                clearTimeout(this.checkTimer);
                this.checkTimer = null;
            }
        };
        this.clearResponseTimer = () => {
            if (this.responseTimer) {
                clearTimeout(this.responseTimer);
                this.responseTimer = null;
            }
        };
        this.getGuildLocale = async () => {
            try {
                return (await this.localeDetector.getGuildLanguage(this.player.guildId)) || 'en';
            }
            catch (error) {
                this.client.logger?.warn(`[ActivityCheckManager] Failed to get guild locale: ${error}`);
                return 'en';
            }
        };
        this.sendActivityCheck = async () => {
            if (this.destroyed || !this.player || this.isPendingResponse)
                return;
            const currentTrack = await this.player.queue?.getCurrent();
            if (!currentTrack) {
                this.client.logger?.debug(`[ActivityCheckManager] No current track, skipping activity check`);
                return;
            }
            if (!this.player.playing && !this.player.paused) {
                this.client.logger?.debug(`[ActivityCheckManager] Player not active, skipping activity check`);
                return;
            }
            const textChannelId = this.player.textChannelId;
            if (!textChannelId) {
                this.client.logger?.warn(`[ActivityCheckManager] No text channel for guild ${this.player.guildId}`);
                return;
            }
            try {
                const channel = await this.client.channels.fetch(textChannelId);
                if (!channel?.isTextBased()) {
                    this.client.logger?.warn(`[ActivityCheckManager] Invalid text channel for guild ${this.player.guildId}`);
                    return;
                }
                const locale = await this.getGuildLocale();
                const responseHandler = new handlers_1.MusicResponseHandler(this.client);
                const embed = responseHandler.createActivityCheckEmbed(locale);
                const button = responseHandler.getActivityCheckButton(false, locale);
                const message = await (0, msg_1.send)(this.client, channel.id, { embeds: [embed], components: [button] });
                if (message) {
                    this.activeMessage = message;
                    this.isPendingResponse = true;
                    this.startResponseTimer();
                    this.client.logger?.info(`[ActivityCheckManager] Activity check sent for guild ${this.player.guildId}`);
                }
            }
            catch (error) {
                this.client.logger?.error(`[ActivityCheckManager] Failed to send activity check: ${error}`);
                this.startCheckTimer();
            }
        };
        this.startResponseTimer = () => {
            this.clearResponseTimer();
            this.responseTimer = setTimeout(async () => {
                if (this.destroyed || !this.isPendingResponse)
                    return;
                await this.handleNoResponse();
            }, RESPONSE_TIMEOUT);
            this.client.logger?.debug(`[ActivityCheckManager] Response timer started, will timeout in 5 minutes`);
        };
        this.handleNoResponse = async () => {
            if (this.destroyed)
                return;
            const textChannelId = this.player.textChannelId;
            const locale = await this.getGuildLocale();
            if (this.activeMessage) {
                try {
                    const responseHandler = new handlers_1.MusicResponseHandler(this.client);
                    const embed = responseHandler.createActivityCheckTimeoutEmbed(locale);
                    const disabledButton = responseHandler.getActivityCheckButton(true, locale);
                    await this.activeMessage.edit({ embeds: [embed], components: [disabledButton] });
                }
                catch (error) {
                    this.client.logger?.warn(`[ActivityCheckManager] Failed to update timeout message: ${error}`);
                }
            }
            let is247 = false;
            try {
                const guild = await music_guild_1.default.findOne({ guildId: this.player.guildId });
                is247 = guild?.twentyFourSeven ?? false;
            }
            catch (error) {
                this.client.logger?.warn(`[ActivityCheckManager] Failed to check 24/7 mode: ${error}`);
            }
            if (is247) {
                this.client.logger?.info(`[ActivityCheckManager] 24/7 mode enabled for guild ${this.player.guildId}, stopping playback but keeping connection`);
                this.player.queue.clear();
                this.player.stop();
                this.isPendingResponse = false;
                this.activeMessage = null;
                this.startCheckTimer();
                if (textChannelId) {
                    try {
                        const channel = await this.client.channels.fetch(textChannelId);
                        if (channel?.isTextBased()) {
                            const responseHandler = new handlers_1.MusicResponseHandler(this.client);
                            const embed = responseHandler.createInfoEmbed(this.client.localizationManager?.translate('responses.activity_check.stopped_twenty_four_seven', locale) || '⏹️ Stopped playback due to inactivity. 24/7 mode is active, so the bot will remain in the voice channel.');
                            await (0, msg_1.send)(this.client, channel.id, { embeds: [embed] });
                        }
                    }
                    catch (error) {
                        this.client.logger?.warn(`[ActivityCheckManager] Failed to send 24/7 stop message: ${error}`);
                    }
                }
                return;
            }
            this.client.logger?.info(`[ActivityCheckManager] No response received for guild ${this.player.guildId}, destroying player`);
            if (textChannelId) {
                try {
                    const channel = await this.client.channels.fetch(textChannelId);
                    if (channel?.isTextBased()) {
                        const responseHandler = new handlers_1.MusicResponseHandler(this.client);
                        const embed = responseHandler.createInfoEmbed(this.client.localizationManager?.translate('responses.activity_check.disconnected', locale) || '🔌 Disconnected due to inactivity (no response to activity check)');
                        await (0, msg_1.send)(this.client, channel.id, { embeds: [embed] });
                    }
                }
                catch (error) {
                    this.client.logger?.warn(`[ActivityCheckManager] Failed to send disconnect message: ${error}`);
                }
            }
            _a.removeInstance(this.player.guildId);
            this.player.destroy();
        };
        this.player = player;
        this.client = client;
        this.localeDetector = new locales_1.LocaleDetector();
        this.sessionStartTime = Date.now();
        this.startCheckTimer();
    }
}
exports.ActivityCheckManager = ActivityCheckManager;
_a = ActivityCheckManager;
ActivityCheckManager.instances = new Map();
ActivityCheckManager.getInstance = (guildId, player, client) => {
    if (!_a.instances.has(guildId))
        _a.instances.set(guildId, new _a(player, client));
    return _a.instances.get(guildId);
};
ActivityCheckManager.removeInstance = (guildId) => {
    const instance = _a.instances.get(guildId);
    if (instance) {
        instance.destroy();
        _a.instances.delete(guildId);
    }
};
ActivityCheckManager.hasInstance = (guildId) => {
    return _a.instances.has(guildId);
};
