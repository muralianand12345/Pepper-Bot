import discord from "discord.js";
import magmastream from "magmastream";
import PlaylistSuggestion from "./playlist_suggestion";
import { ISongs } from "../../types";

/**
 * Manages custom autoplay functionality independent of YouTube's autoplay system
 * Uses PlaylistSuggestion to generate recommendations based on user listening habits
 */
class AutoplayManager {
    private static instances: Map<string, AutoplayManager> = new Map();
    private client: discord.Client;
    private player: magmastream.Player;
    private guildId: string;
    private enabled: boolean = false;
    private recommendationEngine: PlaylistSuggestion;
    private lastProcessedTrackUri: string | null = null;
    private processing: boolean = false;
    private autoplayOwnerId: string | null = null;
    private readonly recommendationCount: number = 3;

    private recentlyPlayedTracks: Set<string> = new Set();
    private readonly maxHistorySize: number = 20;

    /**
     * Private constructor - use getInstance() instead
     * @param guildId - Discord guild ID
     * @param player - Music player instance
     * @param client - Discord client
     */
    private constructor(
        guildId: string,
        player: magmastream.Player,
        client: discord.Client
    ) {
        this.guildId = guildId;
        this.player = player;
        this.client = client;
        this.recommendationEngine = new PlaylistSuggestion(client);
        this.setupListeners();
    }

    /**
     * Get an AutoplayManager instance for a guild, creating one if it doesn't exist
     * @param guildId - Discord guild ID
     * @param player - Music player instance
     * @param client - Discord client
     * @returns AutoplayManager instance
     */
    public static getInstance(
        guildId: string,
        player: magmastream.Player,
        client: discord.Client
    ): AutoplayManager {
        if (!this.instances.has(guildId)) {
            this.instances.set(guildId, new AutoplayManager(guildId, player, client));
        }
        return this.instances.get(guildId)!;
    }

    /**
     * Remove an instance for a guild (cleanup)
     * @param guildId - Guild ID to remove instance for
     */
    public static removeInstance(guildId: string): void {
        const instance = this.instances.get(guildId);
        if (instance) {
            instance.disable();
            this.instances.delete(guildId);
        }
    }

    /**
     * Setup event listeners for the player
     * @private
     */
    private setupListeners(): void {
        this.client.logger.debug(`[AUTOPLAY] Setup listeners for guild ${this.guildId}`);
    }

    /**
     * Enable autoplay for this guild with the specified user as the "owner"
     * @param userId - Discord user ID who enabled autoplay (for recommendation context)
     * @returns Whether enabling was successful
     */
    public enable(userId: string | undefined): boolean {
        this.enabled = true;
        this.autoplayOwnerId = userId || null;
        this.client.logger.info(
            `[AUTOPLAY] Enabled for guild ${this.guildId} by user ${userId || "Unknown"}`
        );
        return true;
    }

    /**
     * Disable autoplay for this guild
     * @returns Whether disabling was successful
     */
    public disable(): boolean {
        this.enabled = false;
        this.client.logger.info(`[AUTOPLAY] Disabled for guild ${this.guildId}`);
        return true;
    }

    /**
     * Check if autoplay is enabled for this guild
     * @returns Whether autoplay is enabled
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Add a track to the recently played list to prevent repeats
     * @param track - Track to add to history
     */
    private addToRecentlyPlayed(track: magmastream.Track | ISongs): void {
        if (!track || !track.uri) return;

        this.recentlyPlayedTracks.add(track.uri);

        if (this.recentlyPlayedTracks.size > this.maxHistorySize) {
            const trackArray = Array.from(this.recentlyPlayedTracks);
            this.recentlyPlayedTracks = new Set(trackArray.slice(1));
        }
    }

    /**
     * Process the current track to determine if we need to add recommendations to the queue
     * @param finishedTrack - Track that just finished playing
     * @returns Promise<boolean> - Whether processing was successful
     */
    public async processTrack(finishedTrack: magmastream.Track): Promise<boolean> {
        if (!this.enabled || this.processing) {
            return false;
        }

        if (!finishedTrack || !finishedTrack.uri) {
            this.client.logger.warn(
                `[AUTOPLAY] Cannot process autoplay for guild ${this.guildId}: Invalid track`
            );
            return false;
        }

        if (this.lastProcessedTrackUri === finishedTrack.uri) {
            return false;
        }

        this.processing = true;
        this.lastProcessedTrackUri = finishedTrack.uri;
        this.addToRecentlyPlayed(finishedTrack);

        try {
            const queueSize = this.player.queue.size;
            if (queueSize < 2) {
                await this.addRecommendationsToQueue(finishedTrack);
            }

            this.processing = false;
            return true;
        } catch (error) {
            this.client.logger.error(`[AUTOPLAY] Error processing track: ${error}`);
            this.processing = false;
            return false;
        }
    }

    /**
     * Add recommendations to the queue based on the provided track
     * @param seedTrack - Track to base recommendations on
     * @returns Promise<number> - Number of tracks added
     * @private
     */
    private async addRecommendationsToQueue(seedTrack: magmastream.Track): Promise<number> {
        try {
            const seedSong: ISongs = {
                track: seedTrack.title || "Unknown",
                artworkUrl: seedTrack.artworkUrl || "",
                sourceName: seedTrack.sourceName || "unknown",
                title: seedTrack.title || "Unknown",
                identifier: seedTrack.identifier || "",
                author: seedTrack.author || "Unknown",
                duration: seedTrack.duration || 0,
                isrc: seedTrack.isrc || "",
                isSeekable: !!seedTrack.isSeekable,
                isStream: !!seedTrack.isStream,
                uri: seedTrack.uri || "",
                thumbnail: seedTrack.thumbnail || null,
                requester: null,
                played_number: 1,
                timestamp: new Date()
            };

            const userId = this.autoplayOwnerId ||
                (seedTrack.requester as discord.User)?.id ||
                this.client.user?.id || null;

            const { recommendations } = await this.recommendationEngine.getSuggestionsFromUserTopSong(
                userId || "",
                this.guildId,
                this.recommendationCount * 2
            );

            if (!recommendations || recommendations.length === 0) {
                this.client.logger.warn(
                    `[AUTOPLAY] No recommendations found for guild ${this.guildId}`
                );
                return 0;
            }

            const validRecommendations = recommendations.filter(
                (rec) => {
                    return rec &&
                        rec.uri &&
                        rec.title &&
                        !this.recentlyPlayedTracks.has(rec.uri);
                }
            );

            if (validRecommendations.length === 0) {
                this.client.logger.warn(
                    `[AUTOPLAY] No valid recommendations found for guild ${this.guildId} (all were recently played)`
                );
                return 0;
            }

            let requester: discord.User | discord.ClientUser | undefined = this.client.user || undefined;
            if (!requester) {
                this.client.logger.warn(`[AUTOPLAY] No client user available`);
                requester = seedTrack.requester as discord.User;
            }

            let addedCount = 0;
            const recommendationsToAdd = validRecommendations.slice(0, this.recommendationCount);

            for (const recommendation of recommendationsToAdd) {
                try {
                    const searchResult = await this.client.manager.search(
                        recommendation.uri,
                        requester
                    );

                    if (
                        searchResult &&
                        searchResult.tracks &&
                        searchResult.tracks.length > 0
                    ) {
                        const track = searchResult.tracks[0];

                        if (!this.recentlyPlayedTracks.has(track.uri)) {
                            this.player.queue.add(track);
                            this.addToRecentlyPlayed(track);
                            addedCount++;

                            this.client.logger.info(
                                `[AUTOPLAY] Added '${track.title}' by '${track.author}' to queue in guild ${this.guildId}`
                            );
                        }
                    } else {
                        const searchQuery = `${recommendation.author} - ${recommendation.title}`;
                        const fallbackResults = await this.client.manager.search(
                            searchQuery,
                            requester
                        );

                        if (
                            fallbackResults &&
                            fallbackResults.tracks &&
                            fallbackResults.tracks.length > 0
                        ) {
                            const track = fallbackResults.tracks[0];

                            if (!this.recentlyPlayedTracks.has(track.uri)) {
                                this.player.queue.add(track);
                                this.addToRecentlyPlayed(track);
                                addedCount++;

                                this.client.logger.info(
                                    `[AUTOPLAY] Added '${track.title}' by '${track.author}' to queue in guild ${this.guildId} (fallback method)`
                                );
                            }
                        }
                    }
                } catch (error) {
                    this.client.logger.error(
                        `[AUTOPLAY] Failed to add recommendation to queue: ${error}`
                    );
                }
            }

            if (addedCount > 0 && !this.player.playing && !this.player.paused) {
                this.player.play();
            }

            this.client.logger.info(
                `[AUTOPLAY] Added ${addedCount} recommendations to queue in guild ${this.guildId}`
            );

            return addedCount;
        } catch (error) {
            this.client.logger.error(
                `[AUTOPLAY] Error adding recommendations to queue: ${error}`
            );
            return 0;
        }
    }

    /**
     * Get the list of recently played track URIs
     * Useful for debugging or external components
     * @returns Array of track URIs
     */
    public getRecentlyPlayedTracks(): string[] {
        return Array.from(this.recentlyPlayedTracks);
    }

    /**
     * Clear the recently played tracks history
     * Useful for testing or when user wants to reset recommendations
     */
    public clearHistory(): void {
        this.recentlyPlayedTracks.clear();
        this.client.logger.info(`[AUTOPLAY] Cleared play history for guild ${this.guildId}`);
    }
}

export default AutoplayManager;