import discord from 'discord.js';
import magmastream from 'magmastream';

import { MusicDB } from '../repo';
import { getRequester } from '../func';
import { ISongs } from '../../../types';
import { SpotifySearchService } from '../search';

export class PlaylistSuggestion {
	private client: discord.Client;
	private readonly defaultLimit: number = 20;
	private readonly similarityThreshold: number = 0.4;
	private spotifyService: SpotifySearchService;

	constructor(client: discord.Client) {
		this.client = client;
		this.spotifyService = SpotifySearchService.getInstance(client);
	}

	private convertTrackToISongs = (track: magmastream.Track): ISongs => {
		const requesterData = track.requester ? getRequester(this.client, track.requester) : null;

		return {
			track: track.title || 'Unknown Track',
			artworkUrl: track.artworkUrl || '',
			sourceName: track.sourceName || 'unknown',
			title: track.title || 'Unknown Track',
			identifier: track.identifier || `unknown_${Date.now()}`,
			author: track.author || 'Unknown Artist',
			duration: track.duration || 0,
			isrc: track.isrc || '',
			isSeekable: track.isSeekable !== undefined ? track.isSeekable : true,
			isStream: track.isStream !== undefined ? track.isStream : false,
			uri: track.uri || '',
			thumbnail: track.thumbnail || null,
			requester: requesterData,
			played_number: 1,
			timestamp: new Date(),
		};
	};

	public getSuggestionsFromUserTopSong = async (userId: string, guildId: string, limit: number = this.defaultLimit): Promise<{ seedSong: ISongs | null; recommendations: ISongs[] }> => {
		try {
			const startTime = Date.now();
			const userTopSongs = await MusicDB.getUserTopSongs(userId, 1);
			const seedSong = userTopSongs && userTopSongs.length > 0 ? userTopSongs[0] : null;

			if (!seedSong) {
				this.client.logger.warn(`[PLAYLIST_SUGGESTION] No top song found for user ${userId}`);
				return { seedSong: null, recommendations: [] };
			}

			this.client.logger.info(`[PLAYLIST_SUGGESTION] Using top song "${seedSong.title}" by ${seedSong.author} as seed`);

			const recommendations = await this.getSuggestions(userId, guildId, seedSong, limit);
			const endTime = Date.now();
			this.client.logger.info(`[PLAYLIST_SUGGESTION] Generated ${recommendations.length} suggestions in ${endTime - startTime}ms`);

			return { seedSong, recommendations };
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] Error getting suggestions from user top song: ${error}`);
			return { seedSong: null, recommendations: [] };
		}
	};

	public getSuggestions = async (userId: string, guildId: string, seedTrack: ISongs, limit: number = this.defaultLimit): Promise<ISongs[]> => {
		try {
			const suggestions: ISongs[] = [];
			let remainingSlots = limit;

			if (remainingSlots > 0) {
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Getting Spotify recommendations for ${seedTrack.title}`);
				const spotifyRecommendations = await this.getSpotifyRecommendations(seedTrack, Math.ceil(remainingSlots * 0.4));
				suggestions.push(...spotifyRecommendations);
				remainingSlots -= spotifyRecommendations.length;
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Found ${spotifyRecommendations.length} Spotify recommendations`);
			}

			if (remainingSlots > 0) {
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Getting track-based recommendations for ${seedTrack.title}`);
				const trackBasedSuggestions = await this.getTrackBasedSuggestions(seedTrack, userId, guildId, Math.ceil(remainingSlots * 0.3));
				const filteredTrackSuggestions = trackBasedSuggestions.filter((track) => !suggestions.some((existing) => existing.uri === track.uri));
				suggestions.push(...filteredTrackSuggestions);
				remainingSlots -= filteredTrackSuggestions.length;
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Found ${filteredTrackSuggestions.length} track-based suggestions`);
			}

			if (remainingSlots > 0) {
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Getting user history recommendations for ${userId}`);
				const userSuggestions = await this.getUserTopRecommendations(userId, Math.ceil(remainingSlots * 0.4), [seedTrack, ...suggestions]);
				suggestions.push(...userSuggestions);
				remainingSlots -= userSuggestions.length;
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Found ${userSuggestions.length} user history suggestions`);
			}

			if (remainingSlots > 0) {
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Getting guild recommendations for ${guildId}`);
				const guildSuggestions = await this.getGuildRecommendations(guildId, Math.ceil(remainingSlots * 0.5), [seedTrack, ...suggestions]);
				suggestions.push(...guildSuggestions);
				remainingSlots -= guildSuggestions.length;
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Found ${guildSuggestions.length} guild suggestions`);
			}

			if (remainingSlots > 0) {
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Getting global recommendations`);
				const globalSuggestions = await this.getGlobalRecommendations(remainingSlots, [seedTrack, ...suggestions]);
				suggestions.push(...globalSuggestions);
				remainingSlots -= globalSuggestions.length;
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Found ${globalSuggestions.length} global suggestions`);
			}

			if (remainingSlots > 0) {
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Getting Magmastream recommendations`);
				const magmastreamSuggestions = await this.getMagmastreamRecommendations(seedTrack, remainingSlots, suggestions);
				suggestions.push(...magmastreamSuggestions);
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] Found ${magmastreamSuggestions.length} Magmastream suggestions`);
			}

			const validSuggestions = suggestions.filter((track) => track && track.uri && track.uri.trim() !== '');
			return this.shuffleArray(validSuggestions).slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] Error getting suggestions: ${error}`);
			return [];
		}
	};

	private getSpotifyRecommendations = async (seedTrack: ISongs, limit: number): Promise<ISongs[]> => {
		try {
			if (!seedTrack || !seedTrack.title || !seedTrack.author) {
				this.client.logger.warn(`[PLAYLIST_SUGGESTION] Invalid seed track for Spotify recommendations`);
				return [];
			}

			const spotifyRecommendations = await this.spotifyService.getRecommendationsBasedOnTrack(seedTrack, limit);

			if (spotifyRecommendations.length === 0) {
				this.client.logger.debug(`[PLAYLIST_SUGGESTION] No Spotify recommendations found, trying alternative search`);

				const artistTracks = await this.spotifyService.searchTracksByArtist(seedTrack.author, limit);
				const alternativeRecommendations = artistTracks
					.filter((track) => track.name.toLowerCase() !== seedTrack.title.toLowerCase())
					.slice(0, limit)
					.map((track) => this.spotifyService.convertSpotifyTrackToISongs(track));

				return alternativeRecommendations;
			}

			this.client.logger.log(`[PLAYLIST_SUGGESTION] Found ${spotifyRecommendations.length} Spotify recommendations for "${seedTrack.title}" by ${seedTrack.author}`);
			return spotifyRecommendations;
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] Spotify recommendations error: ${error}`);
			return [];
		}
	};

	private getTrackBasedSuggestions = async (track: ISongs, userId: string, guildId: string, limit: number): Promise<ISongs[]> => {
		try {
			if (!track || !track.title || !track.author) {
				this.client.logger.warn(`[PLAYLIST_SUGGESTION] Invalid track provided for recommendations`);
				return [];
			}

			let userTracks: ISongs[] = [];
			let guildTracks: ISongs[] = [];

			if (userId) {
				const userData = await MusicDB.getUserMusicHistory(userId);
				if (userData && userData.songs) userTracks = userData.songs.filter((s) => s && s.uri && s.title && s.author && s.uri !== track.uri);
			}

			if (guildId) {
				const guildData = await MusicDB.getGuildMusicHistory(guildId);
				if (guildData && guildData.songs) guildTracks = guildData.songs.filter((s) => s && s.uri && s.title && s.author && s.uri !== track.uri);
			}

			const combinedTracks = [...userTracks, ...guildTracks];
			if (combinedTracks.length === 0) return [];

			const similarTracks = combinedTracks.filter((s) => {
				if (!s || !s.title || !s.author) return false;

				const titleSimilarity = this.calculateSimilarity(track.title, s.title);
				const authorSimilarity = this.calculateSimilarity(track.author, s.author);
				return titleSimilarity > this.similarityThreshold || authorSimilarity > 0.7;
			});

			const uniqueTracks = this.removeDuplicates(similarTracks);
			if (uniqueTracks.length < limit) {
				const globalSimilarTracks = await this.getGlobalSimilarTracks(track, limit - uniqueTracks.length);
				if (globalSimilarTracks.length > 0) uniqueTracks.push(...globalSimilarTracks);
			}

			return uniqueTracks.slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] Track-based suggestion error: ${error}`);
			return [];
		}
	};

	private getGlobalSimilarTracks = async (track: ISongs, limit: number): Promise<ISongs[]> => {
		try {
			if (!track || !track.title || !track.author) return [];

			const globalData = await MusicDB.getGlobalMusicHistory();
			if (!globalData?.songs?.length) return [];

			const filteredSongs = globalData.songs.filter((song) => song && song.uri && song.title && song.author && song.uri !== track.uri);
			if (filteredSongs.length === 0) return [];

			const sameAuthorTracks = filteredSongs.filter((song) => this.calculateSimilarity(song.author, track.author) > 0.7);

			const titleKeywords = this.extractKeywords(track.title);
			const similarTitleTracks = filteredSongs.filter((song) => {
				if (!song.title) return false;
				const songKeywords = this.extractKeywords(song.title);
				return titleKeywords.some((keyword) => songKeywords.some((songKeyword) => this.calculateSimilarity(keyword, songKeyword) > this.similarityThreshold));
			});

			const combinedTracks = [...sameAuthorTracks, ...similarTitleTracks];
			const dedupedTracks = this.removeDuplicates(combinedTracks);

			return dedupedTracks
				.sort((a, b) => {
					const aAuthorScore = this.calculateSimilarity(a.author, track.author);
					const bAuthorScore = this.calculateSimilarity(b.author, track.author);
					const aTitleScore = this.calculateSimilarity(a.title, track.title);
					const bTitleScore = this.calculateSimilarity(b.title, track.title);

					const aScore = aAuthorScore * 0.7 + aTitleScore * 0.3;
					const bScore = bAuthorScore * 0.7 + bTitleScore * 0.3;

					return bScore - aScore;
				})
				.slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] Global similar tracks error: ${error}`);
			return [];
		}
	};

	private getUserTopRecommendations = async (userId: string, limit: number, existingTracks: ISongs[] = []): Promise<ISongs[]> => {
		try {
			if (!userId) return [];
			const userSongs = await MusicDB.getUserTopSongs(userId, limit * 2);
			if (!userSongs?.length) return [];

			const existingUris = new Set(existingTracks.filter((t) => t && t.uri).map((t) => t.uri));
			const filteredSongs = userSongs.filter((song) => song && song.uri && !existingUris.has(song.uri));

			return filteredSongs.slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] User recommendations error: ${error}`);
			return [];
		}
	};

	private getGuildRecommendations = async (guildId: string, limit: number, existingTracks: ISongs[] = []): Promise<ISongs[]> => {
		try {
			if (!guildId) return [];

			const guildSongs = await MusicDB.getGuildTopSongs(guildId, limit * 2);
			if (!guildSongs?.length) return [];

			const existingUris = new Set(existingTracks.filter((t) => t && t.uri).map((t) => t.uri));
			const filteredSongs = guildSongs.filter((song) => song && song.uri && song.timestamp && !existingUris.has(song.uri));

			if (filteredSongs.length === 0) return [];

			return filteredSongs
				.sort((a, b) => {
					try {
						const recencyScore = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
						return 0.7 * ((b.played_number || 0) - (a.played_number || 0)) + 0.3 * recencyScore;
					} catch (err) {
						return (b.played_number || 0) - (a.played_number || 0);
					}
				})
				.slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] Guild recommendations error: ${error}`);
			return [];
		}
	};

	private getGlobalRecommendations = async (limit: number, existingTracks: ISongs[] = []): Promise<ISongs[]> => {
		try {
			const existingUris = new Set(existingTracks.filter((t) => t && t.uri).map((t) => t.uri));
			const globalData = await MusicDB.getGlobalMusicHistory();
			if (!globalData?.songs?.length) return [];

			return globalData.songs.filter((song) => song && song.uri && !existingUris.has(song.uri)).slice(0, limit);
		} catch (error) {
			this.client.logger.error(`[PLAYLIST_SUGGESTION] Global recommendations error: ${error}`);
			return [];
		}
	};

	private getMagmastreamRecommendations = async (track: ISongs, limit: number, existingTracks: ISongs[] = []): Promise<ISongs[]> => {
		try {
			if (!track || !track.title || !track.author) return [];

			const existingUris = new Set(existingTracks.filter((t) => t && t.uri).map((t) => t.uri));
			const manager = this.client.manager;
			if (!manager) throw new Error('Manager not available');

			const guildIds = Array.from(manager.players.keys());
			if (guildIds.length === 0) throw new Error('No active players available');

			const player = manager.get(guildIds[0]);
			if (!player || typeof player.getRecommendedTracks !== 'function') throw new Error("Player doesn't support recommendations");

			const searchQuery = `${track.author} - ${track.title}`;
			let searchResult;
			searchResult = await manager.search(`spsearch:${searchQuery}`);

			if (!searchResult?.tracks?.length) {
				searchResult = await manager.search(searchQuery);
				if (!searchResult?.tracks?.length) throw new Error('No searchable track found');

				const seedTrack = searchResult.tracks[0];
				const recommendations = await player.getRecommendedTracks(seedTrack);

				if (!recommendations?.length) return [];

				return recommendations
					.filter((t) => t && t.uri && !existingUris.has(t.uri))
					.map((t) => this.convertTrackToISongs(t))
					.slice(0, limit);
			}

			return [];
		} catch (error) {
			this.client.logger.warn(`[PLAYLIST_SUGGESTION] Magmastream recommendations error: ${error}`);
			return [];
		}
	};

	private calculateSimilarity = (str1: string, str2: string): number => {
		if (!str1 || !str2) return 0;

		const s1 = str1.toLowerCase();
		const s2 = str2.toLowerCase();

		if (s1.length === 0 || s2.length === 0) return 0;
		if (s1 === s2) return 1;

		const len1 = s1.length;
		const len2 = s2.length;
		const matrix: number[][] = Array(len1 + 1)
			.fill(null)
			.map(() => Array(len2 + 1).fill(0));

		for (let i = 0; i <= len1; i++) matrix[i][0] = i;
		for (let j = 0; j <= len2; j++) matrix[0][j] = j;

		for (let i = 1; i <= len1; i++) {
			for (let j = 1; j <= len2; j++) {
				const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
				matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
			}
		}

		const maxLen = Math.max(len1, len2);
		return 1 - matrix[len1][len2] / maxLen;
	};

	private extractKeywords = (title: string): string[] => {
		if (!title) return [];

		const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'of', 'from', 'as', 'ft', 'feat', 'featuring']);
		return title
			.toLowerCase()
			.replace(/\([^)]*\)|\[[^\]]*\]/g, '')
			.replace(/[^\w\s]/g, '')
			.split(/\s+/)
			.filter((word) => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word));
	};

	private removeDuplicates = (tracks: ISongs[]): ISongs[] => {
		const seen = new Set<string>();
		return tracks.filter((track) => {
			if (!track || !track.uri) return false;
			if (seen.has(track.uri)) return false;
			seen.add(track.uri);
			return true;
		});
	};

	private shuffleArray = <T>(array: T[]): T[] => {
		if (!array || array.length === 0) return [];
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	};
}
