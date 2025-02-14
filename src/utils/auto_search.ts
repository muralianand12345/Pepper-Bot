import discord from "discord.js";
import axios, { AxiosInstance } from "axios";
import { IAutoCompleteOptions, SpotifySearchResult } from "../types";

/**
 * SpotifyAutoComplete class provides functionality for searching Spotify tracks
 * and retrieving metadata from Spotify URLs.
 *
 * @class SpotifyAutoComplete
 * @description Handles Spotify API authentication, search, and URL metadata retrieval
 * for Discord autocomplete suggestions. Supports tracks, albums, playlists, and artists.
 */
export class SpotifyAutoComplete {
    private token: string | null = null;
    private tokenExpiry: number = 0;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly defaultOptions: IAutoCompleteOptions;
    private spotifyApi: AxiosInstance;
    private authApi: AxiosInstance;

    /**
     * Creates an instance of SpotifyAutoComplete.
     * @param {string} clientId - Spotify API client ID
     * @param {string} clientSecret - Spotify API client secret
     */
    constructor(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.defaultOptions = {
            maxResults: 7,
            language: "en",
        };

        // Create axios instance for Spotify API
        this.spotifyApi = axios.create({
            baseURL: "https://api.spotify.com/v1",
            timeout: 10000,
            headers: {
                "Content-Type": "application/json",
            },
        });

        // Create axios instance for authentication
        this.authApi = axios.create({
            baseURL: "https://accounts.spotify.com/api",
            timeout: 10000,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        // Add response interceptor for error handling
        this.spotifyApi.interceptors.response.use(
            (response) => response,
            (error) => {
                if (axios.isAxiosError(error)) {
                    if (error.response?.status === 401) {
                        // Token expired, refresh it
                        return this.refreshToken().then(() => {
                            const originalRequest = error.config;
                            if (originalRequest && originalRequest.headers) {
                                originalRequest.headers.Authorization = `Bearer ${this.token}`;
                                return this.spotifyApi(originalRequest);
                            }
                        });
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Refreshes the Spotify API access token.
     * @private
     * @returns {Promise<void>}
     * @throws {Error} If token refresh fails
     */
    private refreshToken = async (): Promise<void> => {
        try {
            const auth = Buffer.from(
                `${this.clientId}:${this.clientSecret}`
            ).toString("base64");

            const { data } = await this.authApi.post(
                "/token",
                "grant_type=client_credentials",
                {
                    headers: {
                        Authorization: `Basic ${auth}`,
                    },
                }
            );

            this.token = data.access_token;
            this.tokenExpiry = Date.now() + data.expires_in * 1000;

            // Update the default Authorization header
            this.spotifyApi.defaults.headers.common[
                "Authorization"
            ] = `Bearer ${this.token}`;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Token refresh failed: ${
                        error.response?.data?.error || error.message
                    }`
                );
            }
            throw error;
        }
    };

    /**
     * Checks if the current token is valid and refreshes it if necessary.
     * @private
     * @returns {Promise<void>}
     */
    private checkToken = async (): Promise<void> => {
        if (!this.token || Date.now() >= this.tokenExpiry) {
            await this.refreshToken();
        }
    };

    /**
     * Extracts Spotify ID and content type from a Spotify URL.
     * @private
     * @param {string} url - Spotify URL to parse
     * @returns {{ type: string; id: string } | null} Object containing content type and ID, or null if invalid
     */
    private getSpotifyIdFromUrl = (
        url: string
    ): { type: string; id: string } | null => {
        try {
            const urlObj = new URL(url);
            if (!urlObj.hostname.includes("spotify.com")) return null;

            const pathParts = urlObj.pathname.split("/");
            if (pathParts.length < 3) return null;

            const type = pathParts[1];
            const id = pathParts[2].split("?")[0];

            if (!["track", "album", "playlist", "artist"].includes(type))
                return null;

            return { type, id };
        } catch (error) {
            return null;
        }
    };

    /**
     * Retrieves metadata for a Spotify URL.
     * @private
     * @param {string} url - Spotify URL to get metadata for
     * @returns {Promise<discord.ApplicationCommandOptionChoiceData>} Discord option choice data
     */
    private getMetadataFromUrl = async (
        url: string
    ): Promise<discord.ApplicationCommandOptionChoiceData> => {
        await this.checkToken();

        const urlInfo = this.getSpotifyIdFromUrl(url);
        if (!urlInfo) {
            return { name: url, value: url };
        }

        try {
            const { data } = await this.spotifyApi.get(
                `/${urlInfo.type}s/${urlInfo.id}`
            );

            let name = "";

            switch (urlInfo.type) {
                case "track":
                    name = `${data.name} - ${data.artists[0].name}`;
                    break;
                case "album":
                    name = `Album: ${data.name} - ${data.artists[0].name}`;
                    break;
                case "playlist":
                    name = `Playlist: ${data.name} by ${data.owner.display_name}`;
                    break;
                case "artist":
                    name = `Artist: ${data.name}`;
                    break;
                default:
                    name = "Unknown Spotify Content";
            }

            return {
                name: name.slice(0, 100),
                value: url,
            };
        } catch (error) {
            console.error("Error fetching Spotify metadata:", error);
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return { name: "Invalid Spotify URL", value: url };
            }
            return { name: "Error fetching Spotify metadata", value: url };
        }
    };

    /**
     * Gets autocomplete suggestions for a search query or Spotify URL.
     * @public
     * @param {string} query - Search query or Spotify URL
     * @param {IAutoCompleteOptions} [options={}] - Search options
     * @returns {Promise<discord.ApplicationCommandOptionChoiceData[]>} Array of Discord option choices
     *
     * @example
     * // Search for tracks
     * const suggestions = await spotifyAutoComplete.getSuggestions("bohemian rhapsody");
     *
     * @example
     * // Get metadata for a Spotify URL
     * const metadata = await spotifyAutoComplete.getSuggestions("https://open.spotify.com/track/...");
     */
    public getSuggestions = async (
        query: string,
        options: IAutoCompleteOptions = {}
    ): Promise<discord.ApplicationCommandOptionChoiceData[]> => {
        if (!query?.trim()) return [];

        await this.checkToken();
        const maxResults = options.maxResults || this.defaultOptions.maxResults;

        try {
            if (query.startsWith("https://")) {
                const metadata = await this.getMetadataFromUrl(query);
                return [metadata];
            }

            const { data } = await this.spotifyApi.get<SpotifySearchResult>(
                "/search",
                {
                    params: {
                        q: query,
                        type: "track",
                        limit: maxResults,
                    },
                }
            );

            return data.tracks.items.map((track) => ({
                name: `${track.name} - ${track.artists[0].name}`.slice(0, 100),
                value: track.external_urls.spotify,
            }));
        } catch (error) {
            console.error("Spotify search error:", error);
            return [];
        }
    };
}
