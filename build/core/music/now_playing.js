"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NowPlayingManager = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const locales_1 = require("../locales");
const handlers_1 = require("./handlers");
class NowPlayingManager {
    constructor(player, client) {
        this.message = null;
        this.updateInterval = null;
        this.lastUpdateTime = 0;
        this.UPDATE_INTERVAL = 15000;
        this.MIN_UPDATE_INTERVAL = 5000;
        this.paused = false;
        this.destroyed = false;
        this.stopped = false;
        this.isUpdating = false;
        this.setMessage = (message, forceUpdate = false) => {
            if (message.author.id !== this.client.user?.id)
                return this.client.logger?.warn(`[NowPlayingManager] Attempted to set message not authored by bot`);
            this.message = message;
            if (forceUpdate)
                this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update now playing message: ${err}`));
        };
        this.onPause = () => {
            this.paused = true;
            this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update after pause: ${err}`));
        };
        this.onResume = () => {
            this.paused = false;
            this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update after resume: ${err}`));
        };
        this.onStop = () => {
            this.stopped = true;
            this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update after stop: ${err}`));
        };
        this.startUpdateInterval = () => {
            if (this.updateInterval)
                clearInterval(this.updateInterval);
            this.updateInterval = setInterval(async () => {
                if (this.destroyed || this.stopped || this.isUpdating)
                    return;
                if (!this.player || !this.player.playing || this.paused)
                    return;
                const current = await this.player.queue?.getCurrent();
                if (!current)
                    return;
                const position = this.player.position;
                const duration = current?.duration || 0;
                const remainingTime = duration - position;
                if (remainingTime > 0 && remainingTime < 15000) {
                    this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] End-of-track update error: ${err}`));
                }
                else {
                    this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Regular update error: ${err}`));
                }
            }, this.UPDATE_INTERVAL);
        };
        this.getAdjustedPlayer = () => {
            const playerProxy = Object.create(Object.getPrototypeOf(this.player));
            for (const prop of Object.getOwnPropertyNames(this.player)) {
                if (prop !== 'position')
                    Object.defineProperty(playerProxy, prop, Object.getOwnPropertyDescriptor(this.player, prop));
            }
            Object.defineProperty(playerProxy, 'position', {
                get: () => {
                    const position = this.player.position;
                    // Note: This is synchronous, may need refactoring for async queue access
                    const duration = 0; // Placeholder - need to handle async access differently
                    const remainingTime = duration - position;
                    if (remainingTime <= 10000) {
                        if (remainingTime < 2000)
                            return duration - 100;
                        const scalingFactor = 1 + (10000 - remainingTime) / 10000;
                        return Math.min(position * scalingFactor, duration - 100);
                    }
                    return Math.min(position + 300, duration);
                },
            });
            return playerProxy;
        };
        this.getGuildLocale = async () => {
            try {
                return (await this.localeDetector.getGuildLanguage(this.player.guildId)) || 'en';
            }
            catch (error) {
                this.client.logger?.warn(`[NowPlayingManager] Failed to get guild locale: ${error}`);
                return 'en';
            }
        };
        this.validateMessageAccess = async (message) => {
            try {
                if (!message.channel) {
                    this.client.logger?.warn(`[NowPlayingManager] Message channel is null, clearing reference`);
                    return false;
                }
                const channel = await this.client.channels.fetch(message.channel.id).catch(() => null);
                if (!channel) {
                    this.client.logger?.warn(`[NowPlayingManager] Channel ${message.channel.id} not accessible, clearing reference`);
                    return false;
                }
                if (!channel.isTextBased()) {
                    this.client.logger?.warn(`[NowPlayingManager] Channel ${message.channel.id} is not text-based, clearing reference`);
                    return false;
                }
                try {
                    await message.fetch();
                    return true;
                }
                catch (error) {
                    if (error instanceof discord_js_1.default.DiscordAPIError) {
                        if (error.code === 10008 || error.code === 10003) {
                            this.client.logger?.warn(`[NowPlayingManager] Message or channel deleted, clearing reference`);
                            return false;
                        }
                    }
                    throw error;
                }
            }
            catch (error) {
                this.client.logger?.warn(`[NowPlayingManager] Error validating message access: ${error}`);
                return false;
            }
        };
        this.updateNowPlaying = async () => {
            if (this.isUpdating)
                return;
            const now = Date.now();
            if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL)
                return;
            const currentMessage = this.message;
            if (!currentMessage || !this.player)
                return;
            const currentTrack = await this.player.queue?.getCurrent();
            if (!currentTrack)
                return this.client.logger?.debug(`[NowPlayingManager] No current track, skipping update`);
            this.isUpdating = true;
            try {
                const isMessageValid = await this.validateMessageAccess(currentMessage);
                if (!isMessageValid) {
                    this.message = null;
                    return;
                }
                if (!currentMessage.editable) {
                    this.client.logger?.warn(`[NowPlayingManager] Message is no longer editable, clearing reference`);
                    this.message = null;
                    return;
                }
                const locale = await this.getGuildLocale();
                const adjustedPlayer = this.getAdjustedPlayer();
                const embed = await new handlers_1.MusicResponseHandler(this.client).createMusicEmbed(currentTrack, adjustedPlayer, locale);
                const shouldDisableButtons = this.stopped || !this.player.playing || this.player.state === 'DISCONNECTED';
                const musicButton = new handlers_1.MusicResponseHandler(this.client).getMusicButton(shouldDisableButtons, locale);
                if (this.message === currentMessage && currentMessage.editable) {
                    await currentMessage.edit({ embeds: [embed], components: [musicButton] });
                    this.lastUpdateTime = Date.now();
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    const errorMessage = error.message.toLowerCase();
                    if (errorMessage.includes('channelnotcached') || errorMessage.includes('could not find the channel')) {
                        this.client.logger?.warn(`[NowPlayingManager] Channel not cached, clearing message reference`);
                        this.message = null;
                    }
                    else if (errorMessage.includes('unknown message') || errorMessage.includes('missing access') || errorMessage.includes('cannot edit a deleted message') || errorMessage.includes('cannot edit a message authored by another user')) {
                        this.client.logger?.warn(`[NowPlayingManager] Message error: ${errorMessage}, clearing reference`);
                        this.message = null;
                    }
                    else if (errorMessage.includes('rate limited')) {
                        this.lastUpdateTime = Date.now() + 30000;
                        this.client.logger?.warn(`[NowPlayingManager] Rate limited, backing off for 30 seconds`);
                    }
                    else {
                        this.client.logger?.error(`[NowPlayingManager] Update error: ${error}`);
                    }
                }
                else if (error instanceof discord_js_1.default.DiscordAPIError) {
                    switch (error.code) {
                        case 10008:
                        case 10003:
                            this.client.logger?.warn(`[NowPlayingManager] Message or channel deleted (${error.code}), clearing reference`);
                            this.message = null;
                            break;
                        case 50001:
                        case 50013:
                            this.client.logger?.warn(`[NowPlayingManager] Missing permissions (${error.code}), clearing reference`);
                            this.message = null;
                            break;
                        case 50035:
                            this.client.logger?.warn(`[NowPlayingManager] Invalid form body (${error.code})`);
                            break;
                        default:
                            this.client.logger?.error(`[NowPlayingManager] Discord API error ${error.code}: ${error.message}`);
                    }
                }
                else {
                    this.client.logger?.error(`[NowPlayingManager] Unknown update error: ${error}`);
                }
            }
            finally {
                this.isUpdating = false;
            }
        };
        this.updateOrCreateMessage = async (channel, track) => {
            if (this.isUpdating)
                return;
            if (!track)
                return this.client.logger?.warn(`[NowPlayingManager] Cannot update/create message: track is null`);
            try {
                const channelAccessible = await this.client.channels.fetch(channel.id).catch(() => null);
                if (!channelAccessible)
                    return this.client.logger?.warn(`[NowPlayingManager] Channel ${channel.id} not accessible, skipping update`);
                const locale = await this.getGuildLocale();
                const embed = await new handlers_1.MusicResponseHandler(this.client).createMusicEmbed(track, this.player, locale);
                const shouldDisableButtons = this.stopped || !this.player.playing || this.player.state === 'DISCONNECTED';
                const musicButton = new handlers_1.MusicResponseHandler(this.client).getMusicButton(shouldDisableButtons, locale);
                const currentMessage = this.message;
                if (currentMessage) {
                    const isValid = await this.validateMessageAccess(currentMessage);
                    if (isValid && currentMessage.editable) {
                        await currentMessage
                            .edit({ embeds: [embed], components: [musicButton] })
                            .then(() => this.client.logger?.debug(`[NowPlayingManager] Updated existing message in ${channel.name}`))
                            .catch(async (error) => {
                            this.client.logger?.warn(`[NowPlayingManager] Failed to edit message: ${error}, creating new one`);
                            this.message = null;
                            const newMessage = await channel.send({ embeds: [embed], components: [musicButton] });
                            this.setMessage(newMessage, false);
                        });
                    }
                    else {
                        this.message = null;
                    }
                }
                if (!this.message) {
                    try {
                        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => new discord_js_1.default.Collection());
                        const nowPlayingTranslation = this.client.localizationManager?.translate('responses.music.now_playing', locale) || 'Now Playing';
                        const botMessages = messages.filter((m) => {
                            return m.author.id === this.client.user?.id && m.embeds.length > 0 && (m.embeds[0].title === 'Now Playing' || m.embeds[0].title === nowPlayingTranslation);
                        });
                        const deletePromises = [];
                        for (const [_, msg] of botMessages) {
                            deletePromises.push(msg
                                .delete()
                                .then(() => { })
                                .catch(() => { }));
                        }
                        await Promise.all(deletePromises);
                    }
                    catch (error) {
                        this.client.logger?.warn(`[NowPlayingManager] Error cleaning up old messages: ${error}`);
                    }
                    try {
                        const newMessage = await channel.send({ embeds: [embed], components: [musicButton] });
                        this.setMessage(newMessage, false);
                        this.client.logger?.debug(`[NowPlayingManager] Created new message in ${channel.name}`);
                    }
                    catch (error) {
                        this.client.logger?.error(`[NowPlayingManager] Failed to create new message: ${error}`);
                    }
                }
            }
            catch (error) {
                this.client.logger?.error(`[NowPlayingManager] Error in updateOrCreateMessage: ${error}`);
            }
        };
        this.destroy = () => {
            this.destroyed = true;
            this.isUpdating = false;
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            this.message = null;
        };
        this.hasMessage = () => {
            return this.message !== null;
        };
        this.forceUpdate = async () => {
            if (!this.isUpdating && (await this.player?.queue?.getCurrent()))
                this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Force update failed: ${err}`));
        };
        this.getPlaybackStatus = async () => {
            const current = await this.player?.queue?.getCurrent();
            return {
                position: this.player?.position || 0,
                duration: current?.duration || 0,
                isPlaying: !!this.player?.playing,
                isPaused: !!this.player?.paused,
                track: current || null,
            };
        };
        this.player = player;
        this.client = client;
        this.localeDetector = new locales_1.LocaleDetector();
        this.startUpdateInterval();
    }
}
exports.NowPlayingManager = NowPlayingManager;
_a = NowPlayingManager;
NowPlayingManager.instances = new Map();
NowPlayingManager.getInstance = (guildId, player, client) => {
    if (!_a.instances.has(guildId))
        _a.instances.set(guildId, new _a(player, client));
    return _a.instances.get(guildId);
};
NowPlayingManager.removeInstance = (guildId) => {
    const instance = _a.instances.get(guildId);
    if (instance) {
        instance.destroy();
        _a.instances.delete(guildId);
    }
};
