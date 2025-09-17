"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Autoplay = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = require("magmastream");
const playlist_suggestion_1 = require("./playlist_suggestion");
class Autoplay {
    constructor(guildId, player, client) {
        this.enabled = false;
        this.lastProcessedTrackUri = null;
        this.processing = false;
        this.autoplayOwnerId = null;
        this.recommendationCount = 7;
        this.recentlyPlayedTracks = new Set();
        this.maxHistorySize = 500;
        this.playedTracksHistory = new Map();
        this.fallbackAttempts = 0;
        this.maxFallbackAttempts = 5;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3;
        this.lastSuccessfulRecommendation = Date.now();
        this.maxInactiveTime = 10 * 60 * 1000; // 10 minutes
        this.setupListeners = () => this.client.logger.debug(`[AUTOPLAY] Setup listeners for guild ${this.guildId}`);
        this.enable = (userId) => {
            this.enabled = true;
            this.autoplayOwnerId = userId || null;
            this.fallbackAttempts = 0;
            this.consecutiveFailures = 0;
            this.lastSuccessfulRecommendation = Date.now();
            this.client.logger.info(`[AUTOPLAY] Enabled for guild ${this.guildId} by user ${userId || 'Unknown'}`);
            return true;
        };
        this.disable = () => {
            this.enabled = false;
            this.consecutiveFailures = 0;
            this.client.logger.info(`[AUTOPLAY] Disabled for guild ${this.guildId}`);
            return true;
        };
        this.isEnabled = () => {
            return this.enabled;
        };
        this.isEffectivelyWorking = () => {
            if (!this.enabled)
                return false;
            const timeSinceLastSuccess = Date.now() - this.lastSuccessfulRecommendation;
            const hasRecentSuccess = timeSinceLastSuccess < this.maxInactiveTime;
            const belowFailureThreshold = this.consecutiveFailures < this.maxConsecutiveFailures;
            return hasRecentSuccess && belowFailureThreshold;
        };
        this.addToRecentlyPlayed = (track) => {
            if (!track || !track.uri)
                return;
            this.recentlyPlayedTracks.add(track.uri);
            this.playedTracksHistory.set(track.uri, Date.now());
            if (this.recentlyPlayedTracks.size > this.maxHistorySize) {
                const trackArray = Array.from(this.recentlyPlayedTracks);
                const oldestTracks = trackArray.slice(0, Math.floor(this.maxHistorySize * 0.2));
                oldestTracks.forEach((trackUri) => {
                    this.recentlyPlayedTracks.delete(trackUri);
                    this.playedTracksHistory.delete(trackUri);
                });
            }
        };
        this.clearOldHistory = () => {
            const now = Date.now();
            const dayAgo = 24 * 60 * 60 * 1000;
            const tracksToRemove = [];
            this.playedTracksHistory.forEach((timestamp, uri) => {
                if (now - timestamp > dayAgo) {
                    tracksToRemove.push(uri);
                }
            });
            tracksToRemove.forEach((uri) => {
                this.recentlyPlayedTracks.delete(uri);
                this.playedTracksHistory.delete(uri);
            });
            if (tracksToRemove.length > 0) {
                this.client.logger.info(`[AUTOPLAY] Cleared ${tracksToRemove.length} old tracks from history for guild ${this.guildId}`);
            }
        };
        this.processTrack = async (finishedTrack) => {
            if (!this.enabled || this.processing)
                return false;
            if (!finishedTrack || !finishedTrack.uri) {
                this.client.logger.warn(`[AUTOPLAY] Cannot process autoplay for guild ${this.guildId}: Invalid track`);
                return false;
            }
            if (this.lastProcessedTrackUri === finishedTrack.uri)
                return false;
            this.processing = true;
            this.lastProcessedTrackUri = finishedTrack.uri;
            this.addToRecentlyPlayed(finishedTrack);
            try {
                const queueSize = await this.player.queue.size();
                let added = 0;
                if (queueSize < 3) {
                    added = await this.addRecommendationsToQueue(finishedTrack);
                    if (added === 0) {
                        this.consecutiveFailures++;
                        this.client.logger.warn(`[AUTOPLAY] Failed to add recommendations (${this.consecutiveFailures}/${this.maxConsecutiveFailures}) for guild ${this.guildId}`);
                        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                            this.client.logger.warn(`[AUTOPLAY] Too many consecutive failures, disabling autoplay for guild ${this.guildId}`);
                            await this.sendAutoplayFailedMessage();
                            this.disable();
                            this.processing = false;
                            return false;
                        }
                        await this.handleNoRecommendations();
                        this.processing = false;
                        return false;
                    }
                    else {
                        this.fallbackAttempts = 0;
                        this.consecutiveFailures = 0;
                        this.lastSuccessfulRecommendation = Date.now();
                        this.client.logger.info(`[AUTOPLAY] Successfully added ${added} tracks for guild ${this.guildId}`);
                    }
                }
                this.processing = false;
                return added > 0;
            }
            catch (error) {
                this.client.logger.error(`[AUTOPLAY] Error processing track: ${error}`);
                this.consecutiveFailures++;
                this.processing = false;
                return false;
            }
        };
        this.sendAutoplayFailedMessage = async () => {
            try {
                if (!this.player.textChannelId)
                    return;
                const channel = (await this.client.channels.fetch(this.player.textChannelId));
                if (!channel?.isTextBased())
                    return;
                let guildLocale = 'en';
                try {
                    guildLocale = (await new (await Promise.resolve().then(() => __importStar(require('../../locales')))).LocaleDetector().getGuildLanguage(this.guildId)) || 'en';
                }
                catch (error) { }
                const message = this.client.localizationManager?.translate('responses.music.autoplay_failed', guildLocale) || "🔄 Autoplay couldn't find suitable recommendations and has been automatically disabled";
                const embed = new discord_js_1.default.EmbedBuilder()
                    .setColor('#faa61a')
                    .setDescription(`⚠️ ${message}`)
                    .setFooter({ text: this.client.user?.username || 'Music Bot', iconURL: this.client.user?.displayAvatarURL() });
                await channel.send({ embeds: [embed] });
            }
            catch (error) {
                this.client.logger.error(`[AUTOPLAY] Failed to send autoplay failed message: ${error}`);
            }
        };
        this.handleNoRecommendations = async () => {
            this.fallbackAttempts++;
            this.client.logger.warn(`[AUTOPLAY] No recommendations found (attempt ${this.fallbackAttempts}/${this.maxFallbackAttempts}) for guild ${this.guildId}`);
            if (this.fallbackAttempts >= this.maxFallbackAttempts) {
                this.clearOldHistory();
                const historySize = this.recentlyPlayedTracks.size;
                if (historySize > 100) {
                    const tracksToRemove = Array.from(this.recentlyPlayedTracks).slice(0, Math.floor(historySize * 0.3));
                    tracksToRemove.forEach((uri) => {
                        this.recentlyPlayedTracks.delete(uri);
                        this.playedTracksHistory.delete(uri);
                    });
                    this.client.logger.info(`[AUTOPLAY] Emergency cleanup: removed ${tracksToRemove.length} tracks from history for guild ${this.guildId}`);
                }
                this.fallbackAttempts = 0;
                const fallbackAdded = await this.tryFallbackRecommendations();
                if (fallbackAdded === 0) {
                    this.client.logger.warn(`[AUTOPLAY] All fallback methods failed, disabling autoplay for guild ${this.guildId}`);
                    this.disable();
                }
            }
        };
        this.tryFallbackRecommendations = async () => {
            try {
                const globalHistory = await this.recommendationEngine.getGlobalRecommendations(10, []);
                if (globalHistory.length > 0) {
                    const validTracks = globalHistory.filter((track) => !this.recentlyPlayedTracks.has(track.uri));
                    if (validTracks.length > 0) {
                        const added = await this.addTracksToQueue(validTracks.slice(0, 3));
                        if (added > 0) {
                            this.client.logger.info(`[AUTOPLAY] Added ${added} fallback tracks for guild ${this.guildId}`);
                            return added;
                        }
                    }
                }
                this.client.logger.warn(`[AUTOPLAY] All fallback methods exhausted for guild ${this.guildId}, temporarily clearing 25% of history`);
                const tracksArray = Array.from(this.recentlyPlayedTracks);
                const tracksToRemove = tracksArray.slice(0, Math.floor(tracksArray.length * 0.25));
                tracksToRemove.forEach((uri) => {
                    this.recentlyPlayedTracks.delete(uri);
                    this.playedTracksHistory.delete(uri);
                });
                return 0;
            }
            catch (error) {
                this.client.logger.error(`[AUTOPLAY] Error in fallback recommendations: ${error}`);
                return 0;
            }
        };
        this.addRecommendationsToQueue = async (seedTrack) => {
            try {
                const userId = this.autoplayOwnerId || seedTrack.requester?.id || this.client.user?.id || null;
                const { recommendations } = await this.recommendationEngine.getSuggestionsFromUserTopSong(userId || '', this.guildId, this.recommendationCount * 3);
                if (!recommendations || recommendations.length === 0) {
                    this.client.logger.warn(`[AUTOPLAY] No recommendations found for guild ${this.guildId}`);
                    return 0;
                }
                const validRecommendations = recommendations.filter((rec) => {
                    return rec && rec.uri && rec.title && !this.recentlyPlayedTracks.has(rec.uri);
                });
                if (validRecommendations.length === 0) {
                    this.client.logger.warn(`[AUTOPLAY] No valid recommendations found for guild ${this.guildId} (all were recently played)`);
                    return 0;
                }
                return await this.addTracksToQueue(validRecommendations.slice(0, this.recommendationCount));
            }
            catch (error) {
                this.client.logger.error(`[AUTOPLAY] Error adding recommendations to queue: ${error}`);
                return 0;
            }
        };
        this.addTracksToQueue = async (tracks) => {
            let requester = this.client.user || undefined;
            if (!requester) {
                this.client.logger.warn(`[AUTOPLAY] No client user available`);
                return 0;
            }
            let addedCount = 0;
            for (const track of tracks) {
                try {
                    const searchResult = await this.client.manager.search(track.uri, requester);
                    if (searchResult && !magmastream_1.TrackUtils.isErrorOrEmptySearchResult(searchResult) && 'tracks' in searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
                        const lavalinkTrack = searchResult.tracks[0];
                        if (!this.recentlyPlayedTracks.has(lavalinkTrack.uri)) {
                            await this.player.queue.add(lavalinkTrack);
                            this.addToRecentlyPlayed(lavalinkTrack);
                            addedCount++;
                            this.client.logger.info(`[AUTOPLAY] Added '${lavalinkTrack.title}' by '${lavalinkTrack.author}' to queue in guild ${this.guildId}`);
                        }
                    }
                    else {
                        const searchQuery = `${track.author} - ${track.title}`;
                        const fallbackResults = await this.client.manager.search(searchQuery, requester);
                        if (fallbackResults && !magmastream_1.TrackUtils.isErrorOrEmptySearchResult(fallbackResults) && 'tracks' in fallbackResults && fallbackResults.tracks && fallbackResults.tracks.length > 0) {
                            const lavalinkTrack = fallbackResults.tracks[0];
                            if (!this.recentlyPlayedTracks.has(lavalinkTrack.uri)) {
                                await this.player.queue.add(lavalinkTrack);
                                this.addToRecentlyPlayed(lavalinkTrack);
                                addedCount++;
                                this.client.logger.info(`[AUTOPLAY] Added '${lavalinkTrack.title}' by '${lavalinkTrack.author}' to queue in guild ${this.guildId} (fallback method)`);
                            }
                        }
                    }
                }
                catch (error) {
                    this.client.logger.error(`[AUTOPLAY] Failed to add track to queue: ${error}`);
                }
            }
            if (addedCount > 0 && !this.player.playing && !this.player.paused)
                this.player.play();
            return addedCount;
        };
        this.getRecentlyPlayedTracks = () => {
            return Array.from(this.recentlyPlayedTracks);
        };
        this.clearHistory = () => {
            this.recentlyPlayedTracks.clear();
            this.playedTracksHistory.clear();
            this.fallbackAttempts = 0;
            this.consecutiveFailures = 0;
            this.client.logger.info(`[AUTOPLAY] Cleared play history for guild ${this.guildId}`);
        };
        this.getHistoryStats = () => {
            const timestamps = Array.from(this.playedTracksHistory.values());
            return {
                totalTracked: this.recentlyPlayedTracks.size,
                oldestTrack: timestamps.length > 0 ? Math.min(...timestamps) : null,
                newestTrack: timestamps.length > 0 ? Math.max(...timestamps) : null,
            };
        };
        this.getAutoplayStatus = () => {
            return {
                enabled: this.enabled,
                working: this.isEffectivelyWorking(),
                consecutiveFailures: this.consecutiveFailures,
                lastSuccess: this.lastSuccessfulRecommendation,
                timeSinceLastSuccess: Date.now() - this.lastSuccessfulRecommendation,
            };
        };
        this.guildId = guildId;
        this.player = player;
        this.client = client;
        this.recommendationEngine = new playlist_suggestion_1.PlaylistSuggestion(client);
        this.setupListeners();
    }
}
exports.Autoplay = Autoplay;
_a = Autoplay;
Autoplay.instances = new Map();
Autoplay.getInstance = (guildId, player, client) => {
    if (!_a.instances.has(guildId))
        _a.instances.set(guildId, new _a(guildId, player, client));
    return _a.instances.get(guildId);
};
Autoplay.removeInstance = (guildId) => {
    const instance = _a.instances.get(guildId);
    if (instance) {
        instance.disable();
        _a.instances.delete(guildId);
    }
};
