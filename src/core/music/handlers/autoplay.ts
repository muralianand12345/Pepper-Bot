import discord from 'discord.js';
import magmastream from 'magmastream';

import { ISongs } from '../../../types';
import { PlaylistSuggestion } from './playlist_suggestion';

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
	private readonly recommendationCount: number = 7;
	private recentlyPlayedTracks: Set<string> = new Set();
	private readonly maxHistorySize: number = 500;
	private playedTracksHistory: Map<string, number> = new Map();
	private fallbackAttempts: number = 0;
	private readonly maxFallbackAttempts: number = 5;

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
	};

	public static removeInstance = (guildId: string): void => {
		const instance = this.instances.get(guildId);
		if (instance) {
			instance.disable();
			this.instances.delete(guildId);
		}
	};

	private setupListeners = (): void => this.client.logger.debug(`[AUTOPLAY] Setup listeners for guild ${this.guildId}`);

	public enable = (userId: string | undefined): boolean => {
		this.enabled = true;
		this.autoplayOwnerId = userId || null;
		this.fallbackAttempts = 0;
		this.client.logger.info(`[AUTOPLAY] Enabled for guild ${this.guildId} by user ${userId || 'Unknown'}`);
		return true;
	};

	public disable = (): boolean => {
		this.enabled = false;
		this.client.logger.info(`[AUTOPLAY] Disabled for guild ${this.guildId}`);
		return true;
	};

	public isEnabled = (): boolean => {
		return this.enabled;
	};

	private addToRecentlyPlayed = (track: magmastream.Track | ISongs): void => {
		if (!track || !track.uri) return;

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

	private clearOldHistory = (): void => {
		const now = Date.now();
		const dayAgo = 24 * 60 * 60 * 1000;
		const tracksToRemove: string[] = [];

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
			if (queueSize < 3) {
				const added = await this.addRecommendationsToQueue(finishedTrack);
				if (added === 0) {
					await this.handleNoRecommendations();
				} else {
					this.fallbackAttempts = 0;
				}
			}
			this.processing = false;
			return true;
		} catch (error) {
			this.client.logger.error(`[AUTOPLAY] Error processing track: ${error}`);
			this.processing = false;
			return false;
		}
	};

	private handleNoRecommendations = async (): Promise<void> => {
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

			await this.tryFallbackRecommendations();
		}
	};

	private tryFallbackRecommendations = async (): Promise<void> => {
		try {
			const globalHistory = await this.recommendationEngine.getGlobalRecommendations(10, []);
			if (globalHistory.length > 0) {
				const validTracks = globalHistory.filter((track) => !this.recentlyPlayedTracks.has(track.uri));
				if (validTracks.length > 0) {
					await this.addTracksToQueue(validTracks.slice(0, 3));
					this.client.logger.info(`[AUTOPLAY] Added ${validTracks.length} fallback tracks for guild ${this.guildId}`);
					return;
				}
			}

			this.client.logger.warn(`[AUTOPLAY] All fallback methods exhausted for guild ${this.guildId}, temporarily clearing 25% of history`);
			const tracksArray = Array.from(this.recentlyPlayedTracks);
			const tracksToRemove = tracksArray.slice(0, Math.floor(tracksArray.length * 0.25));
			tracksToRemove.forEach((uri) => {
				this.recentlyPlayedTracks.delete(uri);
				this.playedTracksHistory.delete(uri);
			});
		} catch (error) {
			this.client.logger.error(`[AUTOPLAY] Error in fallback recommendations: ${error}`);
		}
	};

	private addRecommendationsToQueue = async (seedTrack: magmastream.Track): Promise<number> => {
		try {
			const userId = this.autoplayOwnerId || (seedTrack.requester as discord.User)?.id || this.client.user?.id || null;
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
		} catch (error) {
			this.client.logger.error(`[AUTOPLAY] Error adding recommendations to queue: ${error}`);
			return 0;
		}
	};

	private addTracksToQueue = async (tracks: ISongs[]): Promise<number> => {
		let requester: discord.User | discord.ClientUser | undefined = this.client.user || undefined;
		if (!requester) {
			this.client.logger.warn(`[AUTOPLAY] No client user available`);
			return 0;
		}

		let addedCount = 0;

		for (const track of tracks) {
			try {
				const searchResult = await this.client.manager.search(track.uri, requester);
				if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
					const lavalinkTrack = searchResult.tracks[0];
					if (!this.recentlyPlayedTracks.has(lavalinkTrack.uri)) {
						this.player.queue.add(lavalinkTrack);
						this.addToRecentlyPlayed(lavalinkTrack);
						addedCount++;
						this.client.logger.info(`[AUTOPLAY] Added '${lavalinkTrack.title}' by '${lavalinkTrack.author}' to queue in guild ${this.guildId}`);
					}
				} else {
					const searchQuery = `${track.author} - ${track.title}`;
					const fallbackResults = await this.client.manager.search(searchQuery, requester);

					if (fallbackResults && fallbackResults.tracks && fallbackResults.tracks.length > 0) {
						const lavalinkTrack = fallbackResults.tracks[0];
						if (!this.recentlyPlayedTracks.has(lavalinkTrack.uri)) {
							this.player.queue.add(lavalinkTrack);
							this.addToRecentlyPlayed(lavalinkTrack);
							addedCount++;
							this.client.logger.info(`[AUTOPLAY] Added '${lavalinkTrack.title}' by '${lavalinkTrack.author}' to queue in guild ${this.guildId} (fallback method)`);
						}
					}
				}
			} catch (error) {
				this.client.logger.error(`[AUTOPLAY] Failed to add track to queue: ${error}`);
			}
		}

		if (addedCount > 0 && !this.player.playing && !this.player.paused) this.player.play();
		return addedCount;
	};

	public getRecentlyPlayedTracks = (): string[] => {
		return Array.from(this.recentlyPlayedTracks);
	};

	public clearHistory = (): void => {
		this.recentlyPlayedTracks.clear();
		this.playedTracksHistory.clear();
		this.fallbackAttempts = 0;
		this.client.logger.info(`[AUTOPLAY] Cleared play history for guild ${this.guildId}`);
	};

	public getHistoryStats = (): { totalTracked: number; oldestTrack: number | null; newestTrack: number | null } => {
		const timestamps = Array.from(this.playedTracksHistory.values());
		return {
			totalTracked: this.recentlyPlayedTracks.size,
			oldestTrack: timestamps.length > 0 ? Math.min(...timestamps) : null,
			newestTrack: timestamps.length > 0 ? Math.max(...timestamps) : null,
		};
	};
}
