"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Autoplay = void 0;
const playlist_suggestion_1 = require("./playlist_suggestion");
class Autoplay {
    constructor(guildId, player, client) {
        this.enabled = false;
        this.lastProcessedTrackUri = null;
        this.processing = false;
        this.autoplayOwnerId = null;
        this.recommendationCount = 3;
        this.recentlyPlayedTracks = new Set();
        this.maxHistorySize = 20;
        this.setupListeners = () => this.client.logger.debug(`[AUTOPLAY] Setup listeners for guild ${this.guildId}`);
        this.enable = (userId) => {
            this.enabled = true;
            this.autoplayOwnerId = userId || null;
            this.client.logger.info(`[AUTOPLAY] Enabled for guild ${this.guildId} by user ${userId || 'Unknown'}`);
            return true;
        };
        this.disable = () => {
            this.enabled = false;
            this.client.logger.info(`[AUTOPLAY] Disabled for guild ${this.guildId}`);
            return true;
        };
        this.isEnabled = () => {
            return this.enabled;
        };
        this.addToRecentlyPlayed = (track) => {
            if (!track || !track.uri)
                return;
            this.recentlyPlayedTracks.add(track.uri);
            if (this.recentlyPlayedTracks.size > this.maxHistorySize) {
                const trackArray = Array.from(this.recentlyPlayedTracks);
                this.recentlyPlayedTracks = new Set(trackArray.slice(1));
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
                const queueSize = this.player.queue.size;
                if (queueSize < 2)
                    await this.addRecommendationsToQueue(finishedTrack);
                this.processing = false;
                return true;
            }
            catch (error) {
                this.client.logger.error(`[AUTOPLAY] Error processing track: ${error}`);
                this.processing = false;
                return false;
            }
        };
        this.addRecommendationsToQueue = async (seedTrack) => {
            try {
                const userId = this.autoplayOwnerId || seedTrack.requester?.id || this.client.user?.id || null;
                const { recommendations } = await this.recommendationEngine.getSuggestionsFromUserTopSong(userId || '', this.guildId, this.recommendationCount * 2);
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
                let requester = this.client.user || undefined;
                if (!requester) {
                    this.client.logger.warn(`[AUTOPLAY] No client user available`);
                    requester = seedTrack.requester;
                }
                let addedCount = 0;
                const recommendationsToAdd = validRecommendations.slice(0, this.recommendationCount);
                for (const recommendation of recommendationsToAdd) {
                    try {
                        const searchResult = await this.client.manager.search(recommendation.uri, requester);
                        if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
                            const track = searchResult.tracks[0];
                            if (!this.recentlyPlayedTracks.has(track.uri)) {
                                this.player.queue.add(track);
                                this.addToRecentlyPlayed(track);
                                addedCount++;
                                this.client.logger.info(`[AUTOPLAY] Added '${track.title}' by '${track.author}' to queue in guild ${this.guildId}`);
                            }
                        }
                        else {
                            const searchQuery = `${recommendation.author} - ${recommendation.title}`;
                            const fallbackResults = await this.client.manager.search(searchQuery, requester);
                            if (fallbackResults && fallbackResults.tracks && fallbackResults.tracks.length > 0) {
                                const track = fallbackResults.tracks[0];
                                if (!this.recentlyPlayedTracks.has(track.uri)) {
                                    this.player.queue.add(track);
                                    this.addToRecentlyPlayed(track);
                                    addedCount++;
                                    this.client.logger.info(`[AUTOPLAY] Added '${track.title}' by '${track.author}' to queue in guild ${this.guildId} (fallback method)`);
                                }
                            }
                        }
                    }
                    catch (error) {
                        this.client.logger.error(`[AUTOPLAY] Failed to add recommendation to queue: ${error}`);
                    }
                }
                if (addedCount > 0 && !this.player.playing && !this.player.paused)
                    this.player.play();
                this.client.logger.info(`[AUTOPLAY] Added ${addedCount} recommendations to queue in guild ${this.guildId}`);
                return addedCount;
            }
            catch (error) {
                this.client.logger.error(`[AUTOPLAY] Error adding recommendations to queue: ${error}`);
                return 0;
            }
        };
        this.getRecentlyPlayedTracks = () => {
            return Array.from(this.recentlyPlayedTracks);
        };
        this.clearHistory = () => {
            this.recentlyPlayedTracks.clear();
            this.client.logger.info(`[AUTOPLAY] Cleared play history for guild ${this.guildId}`);
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
