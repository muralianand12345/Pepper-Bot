import discord from "discord.js";
import magmastream from "magmastream";

import { ISongs } from "../../../types";
import { PlaylistSuggestion } from "./playlist_suggestion";


export class Autoplay {
    private static instances: Map<string, Autoplay> = new Map();
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

    private constructor(guildId: string, player: magmastream.Player, client: discord.Client) {
        this.guildId = guildId;
        this.player = player;
        this.client = client;
        this.recommendationEngine = new PlaylistSuggestion(client);
        this.setupListeners();
    }

    public static getInstance = (guildId: string, player: magmastream.Player, client: discord.Client): Autoplay => {
        if (!this.instances.has(guildId)) this.instances.set(guildId, new Autoplay(guildId, player, client));
        return this.instances.get(guildId)!;
    }

    public static removeInstance = (guildId: string): void => {
        const instance = this.instances.get(guildId);
        if (instance) {
            instance.disable();
            this.instances.delete(guildId);
        }
    }

    private setupListeners = (): void => this.client.logger.debug(`[AUTOPLAY] Setup listeners for guild ${this.guildId}`);

    public enable = (userId: string | undefined): boolean => {
        this.enabled = true;
        this.autoplayOwnerId = userId || null;
        this.client.logger.info(`[AUTOPLAY] Enabled for guild ${this.guildId} by user ${userId || "Unknown"}`);
        return true;
    }

    public disable = (): boolean => {
        this.enabled = false;
        this.client.logger.info(`[AUTOPLAY] Disabled for guild ${this.guildId}`);
        return true;
    }

    public isEnabled = (): boolean => {
        return this.enabled;
    }

    private addToRecentlyPlayed = (track: magmastream.Track | ISongs): void => {
        if (!track || !track.uri) return;
        this.recentlyPlayedTracks.add(track.uri);
        if (this.recentlyPlayedTracks.size > this.maxHistorySize) {
            const trackArray = Array.from(this.recentlyPlayedTracks);
            this.recentlyPlayedTracks = new Set(trackArray.slice(1));
        }
    }

    public processTrack = async (finishedTrack: magmastream.Track): Promise<boolean> => {
        if (!this.enabled || this.processing) return false;
        if (!finishedTrack || !finishedTrack.uri) {
            this.client.logger.warn(`[AUTOPLAY] Cannot process autoplay for guild ${this.guildId}: Invalid track`);
            return false;
        }

        if (this.lastProcessedTrackUri === finishedTrack.uri) return false;

        this.processing = true;
        this.lastProcessedTrackUri = finishedTrack.uri;
        this.addToRecentlyPlayed(finishedTrack);

        try {
            const queueSize = this.player.queue.size;
            if (queueSize < 2) await this.addRecommendationsToQueue(finishedTrack);
            this.processing = false;
            return true;
        } catch (error) {
            this.client.logger.error(`[AUTOPLAY] Error processing track: ${error}`);
            this.processing = false;
            return false;
        }
    }

    private addRecommendationsToQueue = async (seedTrack: magmastream.Track): Promise<number> => {
        try {
            const userId = this.autoplayOwnerId || (seedTrack.requester as discord.User)?.id || this.client.user?.id || null;
            const { recommendations } = await this.recommendationEngine.getSuggestionsFromUserTopSong(userId || "", this.guildId, this.recommendationCount * 2);

            if (!recommendations || recommendations.length === 0) {
                this.client.logger.warn(`[AUTOPLAY] No recommendations found for guild ${this.guildId}`);
                return 0;
            }

            const validRecommendations = recommendations.filter((rec) => {
                return rec && rec.uri && rec.title && !this.recentlyPlayedTracks.has(rec.uri)
            });
            if (validRecommendations.length === 0) {
                this.client.logger.warn(`[AUTOPLAY] No valid recommendations found for guild ${this.guildId} (all were recently played)`);
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
                    const searchResult = await this.client.manager.search(recommendation.uri, requester);
                    if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
                        const track = searchResult.tracks[0];
                        if (!this.recentlyPlayedTracks.has(track.uri)) {
                            this.player.queue.add(track);
                            this.addToRecentlyPlayed(track);
                            addedCount++;
                            this.client.logger.info(`[AUTOPLAY] Added '${track.title}' by '${track.author}' to queue in guild ${this.guildId}`);
                        }
                    } else {
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
                } catch (error) {
                    this.client.logger.error(`[AUTOPLAY] Failed to add recommendation to queue: ${error}`);
                }
            }

            if (addedCount > 0 && !this.player.playing && !this.player.paused) this.player.play();
            this.client.logger.info(`[AUTOPLAY] Added ${addedCount} recommendations to queue in guild ${this.guildId}`);

            return addedCount;
        } catch (error) {
            this.client.logger.error(`[AUTOPLAY] Error adding recommendations to queue: ${error}`);
            return 0;
        }
    }

    public getRecentlyPlayedTracks = (): string[] => {
        return Array.from(this.recentlyPlayedTracks);
    }

    public clearHistory = (): void => {
        this.recentlyPlayedTracks.clear();
        this.client.logger.info(`[AUTOPLAY] Cleared play history for guild ${this.guildId}`);
    }
};