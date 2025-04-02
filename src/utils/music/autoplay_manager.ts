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
    private readonly recommendationCount: number = 3; // Number of tracks to add at once

    // Track history to prevent repeating songs
    private recentlyPlayedTracks: Set<string> = new Set();
    private readonly maxHistorySize: number = 20; // Maximum number of tracks to remember

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

        // Setup listener for when track ends
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
        // The manager is directly registered to player events in the trackEnd event handler
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

        // Add current track to recently played
        this.recentlyPlayedTracks.add(track.uri);

        // If we've exceeded our history limit, remove oldest entries
        if (this.recentlyPlayedTracks.size > this.maxHistorySize) {
            // Convert to array to remove oldest (first) entry
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
        // Skip if autoplay is disabled or already processing
        if (!this.enabled || this.processing) {
            return false;
        }

        // Check if we have a valid track
        if (!finishedTrack || !finishedTrack.uri) {
            this.client.logger.warn(
                `[AUTOPLAY] Cannot process autoplay for guild ${this.guildId}: Invalid track`
            );
            return false;
        }

        // Skip if we've already processed this track
        if (this.lastProcessedTrackUri === finishedTrack.uri) {
            return false;
        }

        // Mark as processing to prevent multiple concurrent operations
        this.processing = true;
        this.lastProcessedTrackUri = finishedTrack.uri;

        // Add the finished track to our recently played list
        this.addToRecentlyPlayed(finishedTrack);

        try {
            // Get the current queue size
            const queueSize = this.player.queue.size;

            // Only add recommendations if the queue is nearly empty
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
            // Convert track to ISongs format for the recommendation engine
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

            // Determine whose recommendations to use
            const userId = this.autoplayOwnerId ||
                (seedTrack.requester as discord.User)?.id ||
                this.client.user?.id || null;

            // Get recommendations using the PlaylistSuggestion engine
            const { recommendations } = await this.recommendationEngine.getSuggestionsFromUserTopSong(
                userId || "",
                this.guildId,
                this.recommendationCount * 2 // Request more recommendations than needed to account for filtering
            );

            if (!recommendations || recommendations.length === 0) {
                this.client.logger.warn(
                    `[AUTOPLAY] No recommendations found for guild ${this.guildId}`
                );
                return 0;
            }

            // Filter out recently played tracks and the seed track
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

            // Create a requester object - use the bot as requester for autoplay tracks
            let requester: discord.User | discord.ClientUser | undefined = this.client.user || undefined;
            if (!requester) {
                this.client.logger.warn(`[AUTOPLAY] No client user available`);
                requester = seedTrack.requester as discord.User;
            }

            // Add recommendations to the queue (limit to recommendationCount)
            let addedCount = 0;
            const recommendationsToAdd = validRecommendations.slice(0, this.recommendationCount);

            for (const recommendation of recommendationsToAdd) {
                try {
                    // Search for the track using its URI through the manager
                    const searchResult = await this.client.manager.search(
                        recommendation.uri,
                        requester
                    );

                    if (
                        searchResult &&
                        searchResult.tracks &&
                        searchResult.tracks.length > 0
                    ) {
                        // Add the first track to the queue
                        const track = searchResult.tracks[0];

                        // Double-check we haven't already added this
                        if (!this.recentlyPlayedTracks.has(track.uri)) {
                            this.player.queue.add(track);
                            this.addToRecentlyPlayed(track); // Add to history so we don't recommend it again soon
                            addedCount++;

                            this.client.logger.info(
                                `[AUTOPLAY] Added '${track.title}' by '${track.author}' to queue in guild ${this.guildId}`
                            );
                        }
                    } else {
                        // Try a more general search as fallback (using title and author)
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

                            // Make sure this track isn't in recently played
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

            // If not already playing, start playback
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