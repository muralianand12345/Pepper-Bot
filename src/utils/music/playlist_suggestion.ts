import discord from "discord.js";
import magmastream from "magmastream";
import MusicDB from "../../utils/music/music_db";
import { ISongs, ISongsUser } from "../../types";

/**
 * Playlist suggestion class that builds recommendations based on user history
 * Uses the user's top song as a seed for recommendations
 */
class PlaylistSuggestion {
    private client: discord.Client;
    private readonly defaultLimit: number = 20;
    private readonly similarityThreshold: number = 0.4;

    /**
     * Creates a new PlaylistSuggestion instance
     * @param client - Discord client instance for logging
     */
    constructor(client: discord.Client) {
        this.client = client;
    }

    /**
     * Converts a MagmaStream Track to ISongs format
     * @param track - MagmaStream Track object
     * @returns ISongs object with all required fields
     * @private
     */
    private convertTrackToISongs(track: magmastream.Track): ISongs {
        const requester = track.requester as discord.User;

        let requesterData: ISongsUser | null = null;
        if (requester) {
            requesterData = {
                id: requester.id,
                username: requester.username,
                discriminator: requester.discriminator || "0",
                avatar: requester.avatar || undefined,
            };
        }

        return {
            track: track.title || "Unknown Track",
            artworkUrl: track.artworkUrl || "",
            sourceName: track.sourceName || "unknown",
            title: track.title || "Unknown Track",
            identifier: track.identifier || `unknown_${Date.now()}`,
            author: track.author || "Unknown Artist",
            duration: track.duration || 0,
            isrc: track.isrc || "",
            isSeekable: track.isSeekable !== undefined ? track.isSeekable : true,
            isStream: track.isStream !== undefined ? track.isStream : false,
            uri: track.uri || "",
            thumbnail: track.thumbnail || null,
            requester: requesterData,
            played_number: 1,
            timestamp: new Date(),
        };
    }

    /**
     * Get playlist suggestions based on a user's top song
     *
     * @param userId - Discord user ID to get suggestions for
     * @param guildId - Discord guild ID for additional context
     * @param limit - Maximum number of suggestions to return
     * @returns Promise resolving to array of track suggestions and the seed song
     */
    public async getSuggestionsFromUserTopSong(
        userId: string,
        guildId: string,
        limit: number = this.defaultLimit
    ): Promise<{ seedSong: ISongs | null; recommendations: ISongs[] }> {
        try {
            const startTime = Date.now();
            const userTopSongs = await MusicDB.getUserTopSongs(userId, 1);
            const seedSong =
                userTopSongs && userTopSongs.length > 0
                    ? userTopSongs[0]
                    : null;

            if (!seedSong) {
                this.client.logger.warn(
                    `[PLAYLIST_SUGGESTION] No top song found for user ${userId}`
                );
                return { seedSong: null, recommendations: [] };
            }

            this.client.logger.info(
                `[PLAYLIST_SUGGESTION] Using top song "${seedSong.title}" by ${seedSong.author} as seed`
            );

            const recommendations = await this.getSuggestions(
                userId,
                guildId,
                seedSong,
                limit
            );

            const endTime = Date.now();
            this.client.logger.info(
                `[PLAYLIST_SUGGESTION] Generated ${recommendations.length
                } suggestions in ${endTime - startTime}ms`
            );

            const enhancedRecommendations = await this.convertToSpotifyLinks(
                recommendations
            );

            return {
                seedSong,
                recommendations: enhancedRecommendations,
            };
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] Error getting suggestions from user top song: ${error}`
            );
            return { seedSong: null, recommendations: [] };
        }
    }

    /**
     * Get playlist suggestions based on various data sources
     *
     * @param userId - Discord user ID
     * @param guildId - Discord guild ID
     * @param seedTrack - Track to use as a seed for recommendations
     * @param limit - Maximum number of suggestions to return
     * @returns Promise resolving to array of track suggestions
     */
    public async getSuggestions(
        userId: string,
        guildId: string,
        seedTrack: ISongs,
        limit: number = this.defaultLimit
    ): Promise<ISongs[]> {
        try {
            const suggestions: ISongs[] = [];
            let remainingSlots = limit;

            if (remainingSlots > 0) {
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Getting track-based recommendations for ${seedTrack.title}`
                );
                const trackBasedSuggestions =
                    await this.getTrackBasedSuggestions(
                        seedTrack,
                        userId,
                        guildId,
                        Math.ceil(remainingSlots * 0.5)
                    );

                suggestions.push(...trackBasedSuggestions);
                remainingSlots -= trackBasedSuggestions.length;
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Found ${trackBasedSuggestions.length} track-based suggestions`
                );
            }

            if (remainingSlots > 0) {
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Getting user history recommendations for ${userId}`
                );
                const userSuggestions = await this.getUserTopRecommendations(
                    userId,
                    Math.ceil(remainingSlots * 0.3),
                    [seedTrack, ...suggestions]
                );

                suggestions.push(...userSuggestions);
                remainingSlots -= userSuggestions.length;
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Found ${userSuggestions.length} user history suggestions`
                );
            }

            if (remainingSlots > 0) {
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Getting guild recommendations for ${guildId}`
                );
                const guildSuggestions = await this.getGuildRecommendations(
                    guildId,
                    Math.ceil(remainingSlots * 0.5),
                    [seedTrack, ...suggestions]
                );

                suggestions.push(...guildSuggestions);
                remainingSlots -= guildSuggestions.length;
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Found ${guildSuggestions.length} guild suggestions`
                );
            }

            if (remainingSlots > 0) {
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Getting global recommendations`
                );
                const globalSuggestions = await this.getGlobalRecommendations(
                    remainingSlots,
                    [seedTrack, ...suggestions]
                );

                suggestions.push(...globalSuggestions);
                remainingSlots -= globalSuggestions.length;
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Found ${globalSuggestions.length} global suggestions`
                );
            }

            if (remainingSlots > 0) {
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Getting Magmastream recommendations`
                );
                const magmastreamSuggestions =
                    await this.getMagmastreamRecommendations(
                        seedTrack,
                        remainingSlots,
                        suggestions
                    );

                suggestions.push(...magmastreamSuggestions);
                this.client.logger.debug(
                    `[PLAYLIST_SUGGESTION] Found ${magmastreamSuggestions.length} Magmastream suggestions`
                );
            }

            const validSuggestions = suggestions.filter(
                (track) => track && track.uri && track.uri.trim() !== ""
            );

            return this.shuffleArray(validSuggestions).slice(0, limit);
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] Error getting suggestions: ${error}`
            );
            return [];
        }
    }

    /**
     * Converts YouTube or other links to Spotify links where possible
     *
     * @param tracks - Array of tracks to convert
     * @returns Promise resolving to array of tracks with Spotify links where possible
     * @private
     */
    private async convertToSpotifyLinks(tracks: ISongs[]): Promise<ISongs[]> {
        if (!tracks || tracks.length === 0) return [];

        try {
            const manager = this.client.manager;
            if (!manager) {
                throw new Error("Manager not available for link conversion");
            }

            const enhancedTracks = await Promise.all(
                tracks.map(async (track) => {
                    if (!track) return null;

                    if (!track.uri || track.uri.includes("spotify.com")) {
                        return track;
                    }

                    try {
                        const searchQuery = `${track.author || ""} - ${track.title || ""
                            }`.trim();
                        if (!searchQuery) return track;

                        const spotifySearch = await manager.search(
                            `spsearch:${searchQuery}`
                        );

                        if (spotifySearch?.tracks?.length > 0) {
                            const spotifyTrack = spotifySearch.tracks[0];
                            return {
                                ...this.convertTrackToISongs(spotifyTrack),
                                played_number: track.played_number || 1,
                                timestamp: track.timestamp || new Date(),
                            };
                        }
                    } catch (error) {
                        this.client.logger.warn(
                            `[PLAYLIST_SUGGESTION] Failed to convert track "${track.title || "Unknown"
                            }" to Spotify: ${error}`
                        );
                    }

                    return track;
                })
            );

            const validTracks = enhancedTracks.filter(
                (track) => track !== null && track.uri
            ) as ISongs[];

            const spotifyCount = validTracks.filter(
                (track) => track.uri && track.uri.includes("spotify.com")
            ).length;

            this.client.logger.info(
                `[PLAYLIST_SUGGESTION] Converted ${spotifyCount} of ${validTracks.length} tracks to Spotify links`
            );

            return validTracks;
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] Error converting to Spotify links: ${error}`
            );

            return tracks.filter((track) => track && track.uri);
        }
    }

    /**
     * Gets recommendations using Magmastream's built-in recommendation feature
     *
     * @param track - Track to use as seed for recommendations
     * @param limit - Maximum tracks to return
     * @param existingTracks - Tracks to exclude from recommendations
     * @returns Promise resolving to array of tracks
     * @private
     */
    private async getMagmastreamRecommendations(
        track: ISongs,
        limit: number,
        existingTracks: ISongs[] = []
    ): Promise<ISongs[]> {
        try {
            if (!track || !track.title || !track.author) {
                return [];
            }

            const existingUris = new Set(
                existingTracks.filter((t) => t && t.uri).map((t) => t.uri)
            );

            const manager = this.client.manager;

            if (!manager) {
                throw new Error("Manager not available");
            }

            const guildIds = Array.from(manager.players.keys());
            if (guildIds.length === 0) {
                throw new Error("No active players available");
            }

            const player = manager.get(guildIds[0]);
            if (!player || typeof player.getRecommendedTracks !== "function") {
                throw new Error("Player doesn't support recommendations");
            }

            const searchQuery = `${track.author} - ${track.title}`;
            let searchResult;
            searchResult = await manager.search(`spsearch:${searchQuery}`);

            if (!searchResult?.tracks?.length) {
                searchResult = await manager.search(searchQuery);
            }

            if (!searchResult?.tracks?.length) {
                throw new Error("No searchable track found");
            }

            const seedTrack = searchResult.tracks[0];
            const recommendations = await player.getRecommendedTracks(
                seedTrack
            );

            if (!recommendations?.length) {
                return [];
            }

            return recommendations
                .filter((t) => t && t.uri && !existingUris.has(t.uri))
                .map((t) => this.convertTrackToISongs(t))
                .slice(0, limit);
        } catch (error) {
            this.client.logger.warn(
                `[PLAYLIST_SUGGESTION] Magmastream recommendations error: ${error}`
            );
            return [];
        }
    }

    /**
     * Get recommendations based on artists and genres from current track
     *
     * @param track - Seed track for recommendations
     * @param userId - User ID for filtering
     * @param guildId - Guild ID for filtering
     * @param limit - Maximum tracks to return
     * @returns Promise resolving to array of similar tracks
     * @private
     */
    private async getTrackBasedSuggestions(
        track: ISongs,
        userId: string,
        guildId: string,
        limit: number
    ): Promise<ISongs[]> {
        try {
            if (!track || !track.title || !track.author) {
                this.client.logger.warn(
                    `[PLAYLIST_SUGGESTION] Invalid track provided for recommendations`
                );
                return [];
            }

            let userTracks: ISongs[] = [];
            let guildTracks: ISongs[] = [];

            if (userId) {
                const userData = await MusicDB.getUserMusicHistory(userId);
                if (userData && userData.songs) {
                    userTracks = userData.songs.filter(
                        (s) =>
                            s &&
                            s.uri &&
                            s.title &&
                            s.author &&
                            s.uri !== track.uri
                    );
                }
            }

            if (guildId) {
                const guildData = await MusicDB.getGuildMusicHistory(guildId);
                if (guildData && guildData.songs) {
                    guildTracks = guildData.songs.filter(
                        (s) =>
                            s &&
                            s.uri &&
                            s.title &&
                            s.author &&
                            s.uri !== track.uri
                    );
                }
            }

            const combinedTracks = [...userTracks, ...guildTracks];
            if (combinedTracks.length === 0) {
                return [];
            }

            const similarTracks = combinedTracks.filter((s) => {
                if (!s || !s.title || !s.author) return false;

                const titleSimilarity = this.calculateSimilarity(
                    track.title,
                    s.title
                );
                const authorSimilarity = this.calculateSimilarity(
                    track.author,
                    s.author
                );
                return (
                    titleSimilarity > this.similarityThreshold ||
                    authorSimilarity > 0.7
                );
            });

            const uniqueTracks = this.removeDuplicates(similarTracks);

            if (uniqueTracks.length < limit) {
                const globalSimilarTracks = await this.getGlobalSimilarTracks(
                    track,
                    limit - uniqueTracks.length
                );

                if (globalSimilarTracks.length > 0) {
                    uniqueTracks.push(...globalSimilarTracks);
                }
            }

            return uniqueTracks.slice(0, limit);
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] Track-based suggestion error: ${error}`
            );
            return [];
        }
    }
    /**
     * Get global tracks similar to the given track
     *
     * @param track - Track to find similar songs for
     * @param limit - Maximum tracks to return
     * @returns Promise resolving to array of similar tracks
     * @private
     */
    private async getGlobalSimilarTracks(
        track: ISongs,
        limit: number
    ): Promise<ISongs[]> {
        try {
            if (!track || !track.title || !track.author) {
                return [];
            }

            const globalData = await MusicDB.getGlobalMusicHistory();
            if (!globalData?.songs?.length) return [];
            const filteredSongs = globalData.songs.filter(
                (song) =>
                    song &&
                    song.uri &&
                    song.title &&
                    song.author &&
                    song.uri !== track.uri
            );

            if (filteredSongs.length === 0) {
                return [];
            }

            const sameAuthorTracks = filteredSongs.filter(
                (song) =>
                    this.calculateSimilarity(song.author, track.author) > 0.7
            );

            const titleKeywords = this.extractKeywords(track.title);
            const similarTitleTracks = filteredSongs.filter((song) => {
                if (!song.title) return false;
                const songKeywords = this.extractKeywords(song.title);
                return titleKeywords.some((keyword) =>
                    songKeywords.some(
                        (songKeyword) =>
                            this.calculateSimilarity(keyword, songKeyword) >
                            this.similarityThreshold
                    )
                );
            });

            const combinedTracks = [...sameAuthorTracks, ...similarTitleTracks];
            const dedupedTracks = this.removeDuplicates(combinedTracks);
            return dedupedTracks
                .sort((a, b) => {
                    const aAuthorScore = this.calculateSimilarity(
                        a.author,
                        track.author
                    );
                    const bAuthorScore = this.calculateSimilarity(
                        b.author,
                        track.author
                    );
                    const aTitleScore = this.calculateSimilarity(
                        a.title,
                        track.title
                    );
                    const bTitleScore = this.calculateSimilarity(
                        b.title,
                        track.title
                    );

                    const aScore = aAuthorScore * 0.7 + aTitleScore * 0.3;
                    const bScore = bAuthorScore * 0.7 + bTitleScore * 0.3;

                    return bScore - aScore;
                })
                .slice(0, limit);
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] Global similar tracks error: ${error}`
            );
            return [];
        }
    }

    /**
     * Get recommendations based on user's listening history
     *
     * @param userId - Discord user ID
     * @param limit - Maximum tracks to return
     * @param existingTracks - Tracks to exclude from recommendations
     * @returns Promise resolving to array of recommended tracks
     * @private
     */
    private async getUserTopRecommendations(
        userId: string,
        limit: number,
        existingTracks: ISongs[] = []
    ): Promise<ISongs[]> {
        try {
            if (!userId) {
                return [];
            }

            const userSongs = await MusicDB.getUserTopSongs(userId, limit * 2);
            if (!userSongs?.length) return [];

            const existingUris = new Set(
                existingTracks.filter((t) => t && t.uri).map((t) => t.uri)
            );

            const filteredSongs = userSongs.filter(
                (song) => song && song.uri && !existingUris.has(song.uri)
            );

            return filteredSongs.slice(0, limit);
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] User recommendations error: ${error}`
            );
            return [];
        }
    }

    /**
     * Get recommendations based on guild's listening history
     *
     * @param guildId - Discord guild ID
     * @param limit - Maximum tracks to return
     * @param existingTracks - Tracks to exclude from recommendations
     * @returns Promise resolving to array of recommended tracks
     * @private
     */
    private async getGuildRecommendations(
        guildId: string,
        limit: number,
        existingTracks: ISongs[] = []
    ): Promise<ISongs[]> {
        try {
            if (!guildId) {
                return [];
            }

            const guildSongs = await MusicDB.getGuildTopSongs(
                guildId,
                limit * 2
            );
            if (!guildSongs?.length) return [];

            const existingUris = new Set(
                existingTracks.filter((t) => t && t.uri).map((t) => t.uri)
            );

            const filteredSongs = guildSongs.filter(
                (song) =>
                    song &&
                    song.uri &&
                    song.timestamp &&
                    !existingUris.has(song.uri)
            );

            if (filteredSongs.length === 0) {
                return [];
            }

            return filteredSongs
                .sort((a, b) => {
                    try {
                        const recencyScore =
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime();
                        return (
                            0.7 *
                            ((b.played_number || 0) -
                                (a.played_number || 0)) +
                            0.3 * recencyScore
                        );
                    } catch (err) {
                        return (b.played_number || 0) - (a.played_number || 0);
                    }
                })
                .slice(0, limit);
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] Guild recommendations error: ${error}`
            );
            return [];
        }
    }

    /**
     * Get globally popular tracks across all guilds
     *
     * @param limit - Maximum tracks to return
     * @param existingTracks - Tracks to exclude from recommendations
     * @returns Promise resolving to array of globally popular tracks
     * @private
     */
    private async getGlobalRecommendations(
        limit: number,
        existingTracks: ISongs[] = []
    ): Promise<ISongs[]> {
        try {
            const existingUris = new Set(
                existingTracks.filter((t) => t && t.uri).map((t) => t.uri)
            );

            const globalData = await MusicDB.getGlobalMusicHistory();
            if (!globalData?.songs?.length) return [];

            return globalData.songs
                .filter(
                    (song) => song && song.uri && !existingUris.has(song.uri)
                )
                .slice(0, limit);
        } catch (error) {
            this.client.logger.error(
                `[PLAYLIST_SUGGESTION] Global recommendations error: ${error}`
            );
            return [];
        }
    }

    /**
     * Extract artist names from a list of songs
     *
     * @param songs - List of songs to analyze
     * @returns Map of artist names to play count
     * @private
     */
    private getTopArtists(songs: ISongs[]): Map<string, number> {
        const artistCounts = new Map<string, number>();

        songs
            .filter((song) => song && song.author)
            .forEach((song) => {
                const artistName = song.author.toLowerCase();
                const count = artistCounts.get(artistName) || 0;
                artistCounts.set(artistName, count + (song.played_number || 1));
            });

        return artistCounts;
    }

    /**
     * Calculate text similarity between two strings
     * Uses Levenshtein distance for approximate matching
     *
     * @param str1 - First string to compare
     * @param str2 - Second string to compare
     * @returns Similarity score between 0 and 1
     * @private
     */
    private calculateSimilarity(str1: string, str2: string): number {
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
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        const maxLen = Math.max(len1, len2);
        return 1 - matrix[len1][len2] / maxLen;
    }

    /**
     * Extract meaningful keywords from a title
     *
     * @param title - Song title to extract keywords from
     * @returns Array of keywords
     * @private
     */
    private extractKeywords(title: string): string[] {
        if (!title) return [];

        const stopWords = new Set([
            "a",
            "an",
            "the",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "with",
            "by",
            "about",
            "of",
            "from",
            "as",
            "ft",
            "feat",
            "featuring",
        ]);

        return title
            .toLowerCase()
            .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter(
                (word) =>
                    word.length > 2 &&
                    !stopWords.has(word) &&
                    !/^\d+$/.test(word)
            );
    }

    /**
     * Remove duplicate tracks based on URI
     *
     * @param tracks - Array of tracks that may contain duplicates
     * @returns De-duplicated array of tracks
     * @private
     */
    private removeDuplicates(tracks: ISongs[]): ISongs[] {
        const seen = new Set<string>();
        return tracks.filter((track) => {
            if (!track || !track.uri) return false;
            if (seen.has(track.uri)) return false;
            seen.add(track.uri);
            return true;
        });
    }

    /**
     * Shuffle an array using Fisher-Yates algorithm
     *
     * @param array - Array to shuffle
     * @returns Shuffled array
     * @private
     */
    private shuffleArray<T>(array: T[]): T[] {
        if (!array || array.length === 0) return [];

        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

export default PlaylistSuggestion;
