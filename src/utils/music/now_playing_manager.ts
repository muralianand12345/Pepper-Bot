import discord from "discord.js";
import magmastream from "magmastream";
import { musicEmbed, musicButton } from "./embed_template";

/**
 * Class to manage "Now Playing" messages with automatic updates
 * Handles progress bar updates efficiently with rate limit awareness
 */
export class NowPlayingManager {
    private static instances: Map<string, NowPlayingManager> = new Map();
    private message: discord.Message | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private player: magmastream.Player;
    private client: discord.Client;
    private lastUpdateTime: number = 0;
    private readonly UPDATE_INTERVAL = 15000; // Update every 15 seconds
    private readonly MIN_UPDATE_INTERVAL = 5000; // Minimum 5 seconds between updates
    private paused: boolean = false;
    private destroyed: boolean = false;

    /**
     * Get or create an instance for a specific guild
     * @param guildId Guild ID
     * @param player Player instance
     * @param client Discord client
     * @returns NowPlayingManager instance
     */
    public static getInstance(
        guildId: string,
        player: magmastream.Player,
        client: discord.Client
    ): NowPlayingManager {
        if (!this.instances.has(guildId)) {
            this.instances.set(guildId, new NowPlayingManager(player, client));
        }
        return this.instances.get(guildId)!;
    }

    /**
     * Remove an instance for a guild (cleanup)
     * @param guildId Guild ID to remove instance for
     */
    public static removeInstance(guildId: string): void {
        const instance = this.instances.get(guildId);
        if (instance) {
            // instance.destroy();
            this.instances.delete(guildId);
        }
    }

    /**
     * Creates an adapter for the player format that works with formatters
     * @returns A player adapter object compatible with formatters
     * @private
     */
    private createPlayerAdapter(): any {
        // This creates a simple adapter that the progress bar formatter can use
        return {
            position: this.player.position,
            queue: {
                current: {
                    duration: this.player.queue.current?.duration || 0
                }
            }
        };
    }

    /**
 * Get the player with an adjusted position getter
 * @returns Player with adjusted position getter
 * @private
 */
    private getAdjustedPlayer(): magmastream.Player {
        // Create a proper proxy that extends the original player
        const playerProxy = Object.create(Object.getPrototypeOf(this.player));

        // Copy all properties
        for (const prop of Object.getOwnPropertyNames(this.player)) {
            if (prop !== 'position') {
                Object.defineProperty(playerProxy, prop,
                    Object.getOwnPropertyDescriptor(this.player, prop)!);
            }
        }

        // Add the adjusted position getter
        Object.defineProperty(playerProxy, 'position', {
            get: () => {
                const position = this.player.position;
                const duration = this.player.queue.current?.duration || 0;
                const remainingTime = duration - position;

                // If remaining time is less than 10 seconds, adjust more aggressively
                if (remainingTime <= 10000) {
                    // Create a "scaling factor" that accelerates as we get closer to the end
                    // For tracks almost completed (less than 2 seconds left), show at 99%
                    if (remainingTime < 2000) {
                        return duration - 100; // Almost at end (99.9%)
                    }

                    // For tracks between 2-10 seconds from completion, scale progressively
                    const scalingFactor = 1 + ((10000 - remainingTime) / 10000);
                    return Math.min(position * scalingFactor, duration - 100);
                }

                // Normal position with small adjustment for latency
                return Math.min(position + 300, duration);
            }
        });

        return playerProxy;
    }

    /**
     * Private constructor - use getInstance() instead
     * @param player Player instance
     * @param client Discord client
     */
    private constructor(player: magmastream.Player, client: discord.Client) {
        this.player = player;
        this.client = client;
        this.startUpdateInterval();
    }

    /**
     * Set or update the "Now Playing" message
     * @param message Discord message to update
     * @param forceUpdate Force an immediate update
     */
    public setMessage(message: discord.Message, forceUpdate: boolean = false): void {
        this.message = message;

        if (forceUpdate) {
            this.updateNowPlaying().catch(err => {
                this.client.logger?.error(`[NowPlayingManager] Failed to update now playing message: ${err}`);
            });
        }
    }

    /**
     * Called when track playback is paused
     */
    public onPause(): void {
        this.paused = true;
        this.updateNowPlaying().catch(err => {
            this.client.logger?.error(`[NowPlayingManager] Failed to update after pause: ${err}`);
        });
    }

    /**
     * Called when track playback is resumed
     */
    public onResume(): void {
        this.paused = false;
        this.updateNowPlaying().catch(err => {
            this.client.logger?.error(`[NowPlayingManager] Failed to update after resume: ${err}`);
        });
    }

    /**
     * Start the automatic update interval
     * @private
     */
    private startUpdateInterval(): void {
        // Cancel any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Create new update interval
        this.updateInterval = setInterval(() => {
            if (this.destroyed) return;

            // Skip updates if player is paused or not playing
            if (!this.player || !this.player.playing || this.paused) return;

            // Check if we're near the end of a track - if so, update more frequently
            const position = this.player.position;
            const duration = this.player.queue.current?.duration || 0;
            const remainingTime = duration - position;

            // If we're very close to the end (< 15 seconds), force an update immediately
            if (remainingTime > 0 && remainingTime < 15000) {
                this.updateNowPlaying().catch(err => {
                    this.client.logger?.error(`[NowPlayingManager] End-of-track update error: ${err}`);
                });
            } else {
                // Regular update
                this.updateNowPlaying().catch(err => {
                    this.client.logger?.error(`[NowPlayingManager] Regular update error: ${err}`);
                });
            }
        }, this.UPDATE_INTERVAL);
    }

    /**
     * Update the "Now Playing" message with current progress
     * @private
     */
    private async updateNowPlaying(): Promise<void> {
        // Respect rate limits
        const now = Date.now();
        if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
            return;
        }

        // Make sure we have a message and player is active
        if (!this.message || !this.player || !this.player.queue?.current) {
            return;
        }

        try {
            // Use our helper to get an adjusted player
            const adjustedPlayer = this.getAdjustedPlayer();

            // Create the embed with the adjusted player
            const embed = await musicEmbed(
                this.client,
                this.player.queue.current,
                adjustedPlayer
            );

            // Check if the message is still valid before attempting to edit
            if (this.message.editable) {
                await this.message.edit({
                    embeds: [embed],
                    components: [musicButton]
                });
            } else {
                // Message is no longer editable, clear reference
                this.message = null;
            }

            // Update last update timestamp
            this.lastUpdateTime = Date.now();
        } catch (error) {
            // Handle specific known errors
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();

                // Check for common Discord API errors
                if (errorMessage.includes("unknown message") ||
                    errorMessage.includes("missing access") ||
                    errorMessage.includes("cannot edit a deleted message")) {
                    // Message was deleted or bot lost permissions, clear reference
                    this.message = null;
                } else if (errorMessage.includes("rate limited")) {
                    // Handle rate limiting by backing off
                    this.lastUpdateTime = Date.now() + 30000; // Add 30 seconds to back off
                }
            }

            // Don't re-throw the error as it's not critical
            this.client.logger?.warn(`[NowPlayingManager] Update error: ${error}`);
        }
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.destroyed = true;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.message = null;
    }

    /**
     * Whether this manager has an active message
     */
    public hasMessage(): boolean {
        return this.message !== null;
    }

    /**
     * Force an immediate update if conditions allow
     */
    public forceUpdate(): void {
        this.updateNowPlaying().catch(err => {
            this.client.logger?.error(`[NowPlayingManager] Force update failed: ${err}`);
        });
    }

    /**
     * Gets the current playback status of the managed player
     * @returns Object containing current position, duration, isPlaying, isPaused
     */
    public getPlaybackStatus(): {
        position: number;
        duration: number;
        isPlaying: boolean;
        isPaused: boolean;
        track: magmastream.Track | null;
    } {
        return {
            position: this.player?.position || 0,
            duration: this.player?.queue?.current?.duration || 0,
            isPlaying: !!this.player?.playing,
            isPaused: !!this.player?.paused,
            track: this.player?.queue?.current || null
        };
    }
}