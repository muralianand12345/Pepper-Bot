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
    public static getInstance = (
        guildId: string,
        player: magmastream.Player,
        client: discord.Client
    ): NowPlayingManager => {
        if (!this.instances.has(guildId)) {
            this.instances.set(guildId, new NowPlayingManager(player, client));
        }
        return this.instances.get(guildId)!;
    }

    /**
     * Remove an instance for a guild (cleanup)
     * @param guildId Guild ID to remove instance for
     */
    public static removeInstance = (guildId: string): void => {
        const instance = this.instances.get(guildId);
        if (instance) {
            instance.destroy();
            this.instances.delete(guildId);
        }
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
    public setMessage = (message: discord.Message, forceUpdate: boolean = false): void => {
        if (message.author.id !== this.client.user?.id) {
            this.client.logger?.warn(`[NowPlayingManager] Attempted to set message not authored by bot`);
            return;
        }

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
    public onPause = (): void => {
        this.paused = true;
        this.updateNowPlaying().catch(err => {
            this.client.logger?.error(`[NowPlayingManager] Failed to update after pause: ${err}`);
        });
    }

    /**
     * Called when track playback is resumed
     */
    public onResume = (): void => {
        this.paused = false;
        this.updateNowPlaying().catch(err => {
            this.client.logger?.error(`[NowPlayingManager] Failed to update after resume: ${err}`);
        });
    }

    /**
     * Start the automatic update interval
     * @private
     */
    private startUpdateInterval = (): void => {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            if (this.destroyed) return;
            if (!this.player || !this.player.playing || this.paused) return;

            const position = this.player.position;
            const duration = this.player.queue.current?.duration || 0;
            const remainingTime = duration - position;

            if (remainingTime > 0 && remainingTime < 15000) {
                this.updateNowPlaying().catch(err => {
                    this.client.logger?.error(`[NowPlayingManager] End-of-track update error: ${err}`);
                });
            } else {
                this.updateNowPlaying().catch(err => {
                    this.client.logger?.error(`[NowPlayingManager] Regular update error: ${err}`);
                });
            }
        }, this.UPDATE_INTERVAL);
    }

    /**
     * Get the player with adjusted position for smoother progress bar
     * @returns Player with adjusted position getter
     * @private
     */
    private getAdjustedPlayer = (): magmastream.Player => {
        const playerProxy = Object.create(Object.getPrototypeOf(this.player));

        for (const prop of Object.getOwnPropertyNames(this.player)) {
            if (prop !== 'position') {
                Object.defineProperty(playerProxy, prop,
                    Object.getOwnPropertyDescriptor(this.player, prop)!);
            }
        }

        Object.defineProperty(playerProxy, 'position', {
            get: () => {
                const position = this.player.position;
                const duration = this.player.queue.current?.duration || 0;
                const remainingTime = duration - position;

                if (remainingTime <= 10000) {
                    if (remainingTime < 2000) {
                        return duration - 100;
                    }

                    const scalingFactor = 1 + ((10000 - remainingTime) / 10000);
                    return Math.min(position * scalingFactor, duration - 100);
                }

                return Math.min(position + 300, duration);
            }
        });

        return playerProxy;
    }

    /**
     * Update the "Now Playing" message with current progress
     * @private
     */
    private updateNowPlaying = async (): Promise<void> => {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
            return;
        }

        if (!this.message || !this.player || !this.player.queue?.current) {
            return;
        }

        try {
            if (!this.message.editable) {
                this.client.logger?.warn(`[NowPlayingManager] Message is no longer editable, clearing reference`);
                this.message = null;
                return;
            }

            const adjustedPlayer = this.getAdjustedPlayer();
            const embed = await musicEmbed(
                this.client,
                this.player.queue.current,
                adjustedPlayer
            );

            await this.message.edit({
                embeds: [embed],
                components: [musicButton]
            });

            this.lastUpdateTime = Date.now();
        } catch (error) {
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();

                if (errorMessage.includes("unknown message") ||
                    errorMessage.includes("missing access") ||
                    errorMessage.includes("cannot edit a deleted message") ||
                    errorMessage.includes("cannot edit a message authored by another user")) {
                    this.client.logger?.warn(`[NowPlayingManager] Message error: ${errorMessage}, clearing reference`);
                    this.message = null;
                } else if (errorMessage.includes("rate limited")) {
                    this.lastUpdateTime = Date.now() + 30000;
                    this.client.logger?.warn(`[NowPlayingManager] Rate limited, backing off for 30 seconds`);
                } else {
                    this.client.logger?.error(`[NowPlayingManager] Update error: ${error}`);
                }
            } else {
                this.client.logger?.error(`[NowPlayingManager] Unknown update error`);
            }
        }
    }

    /**
     * Update or create a "Now Playing" message
     * @param channel Text channel to send/update the message in
     * @param track Currently playing track
     */
    public updateOrCreateMessage = async (channel: discord.TextChannel, track: magmastream.Track): Promise<void> => {
        try {
            const embed = await musicEmbed(this.client, track, this.player);

            if (this.message && this.message.editable) {
                await this.message.edit({
                    embeds: [embed],
                    components: [musicButton]
                }).then(() => {
                    this.client.logger?.debug(`[NowPlayingManager] Updated existing message in ${channel.name}`);
                }).catch(async (error) => {
                    this.client.logger?.warn(`[NowPlayingManager] Failed to edit message: ${error}, creating new one`);
                    this.message = null;
                    const newMessage = await channel.send({
                        embeds: [embed],
                        components: [musicButton]
                    });

                    this.setMessage(newMessage, false);
                });
            } else {
                try {
                    const messages = await channel.messages.fetch({ limit: 10 });
                    const botMessages = messages.filter(m =>
                        m.author.id === this.client.user?.id &&
                        m.embeds.length > 0 &&
                        m.embeds[0].title === "Now Playing"
                    );

                    const deletePromises = [];
                    for (const [_, msg] of botMessages) {
                        deletePromises.push(msg.delete().catch(() => { }));
                    }
                    await Promise.all(deletePromises);
                } catch (error) {
                    this.client.logger?.warn(`[NowPlayingManager] Error cleaning up old messages: ${error}`);
                }

                try {
                    const newMessage = await channel.send({
                        embeds: [embed],
                        components: [musicButton]
                    });

                    this.setMessage(newMessage, false);
                    this.client.logger?.debug(`[NowPlayingManager] Created new message in ${channel.name}`);
                } catch (error) {
                    this.client.logger?.error(`[NowPlayingManager] Failed to create new message: ${error}`);
                }
            }
        } catch (error) {
            this.client.logger?.error(`[NowPlayingManager] Error in updateOrCreateMessage: ${error}`);
        }
    }

    /**
     * Clean up resources
     */
    public destroy = (): void => {
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
    public hasMessage = (): boolean => {
        return this.message !== null && this.message.editable;
    }

    /**
     * Force an immediate update if conditions allow
     */
    public forceUpdate = (): void => {
        this.updateNowPlaying().catch(err => {
            this.client.logger?.error(`[NowPlayingManager] Force update failed: ${err}`);
        });
    }

    /**
     * Gets the current playback status of the managed player
     * @returns Object containing current position, duration, isPlaying, isPaused
     */
    public getPlaybackStatus = (): {
        position: number;
        duration: number;
        isPlaying: boolean;
        isPaused: boolean;
        track: magmastream.Track | null;
    } => {
        return {
            position: this.player?.position || 0,
            duration: this.player?.queue?.current?.duration || 0,
            isPlaying: !!this.player?.playing,
            isPaused: !!this.player?.paused,
            track: this.player?.queue?.current || null
        };
    }
}