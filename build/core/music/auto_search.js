"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyAutoComplete = void 0;
const axios_1 = __importDefault(require("axios"));
class SpotifyAutoComplete {
    constructor(client, clientId, clientSecret) {
        this.token = null;
        this.tokenExpiry = 0;
        this.refreshToken = async () => {
            try {
                const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
                const { data } = await this.authApi.post("/token", "grant_type=client_credentials", { headers: { Authorization: `Basic ${auth}` } });
                this.token = data.access_token;
                this.tokenExpiry = Date.now() + data.expires_in * 1000;
                this.spotifyApi.defaults.headers.common["Authorization"] = `Bearer ${this.token}`;
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error))
                    throw new Error(`Token refresh failed: ${error.response?.data?.error || error.message}`);
                throw error;
            }
        };
        this.checkToken = async () => {
            if (!this.token || Date.now() >= this.tokenExpiry)
                await this.refreshToken();
        };
        this.getSpotifyIdFromUrl = (url) => {
            try {
                const urlObj = new URL(url);
                if (!urlObj.hostname.includes("spotify.com"))
                    return null;
                const pathParts = urlObj.pathname.split("/");
                if (pathParts.length < 3)
                    return null;
                const type = pathParts[1];
                const id = pathParts[2].split("?")[0];
                if (!["track", "album", "playlist", "artist"].includes(type))
                    return null;
                return { type, id };
            }
            catch (error) {
                return null;
            }
        };
        this.getMetadataFromUrl = async (url) => {
            await this.checkToken();
            const urlInfo = this.getSpotifyIdFromUrl(url);
            if (!urlInfo)
                return { name: url, value: url };
            try {
                const { data } = await this.spotifyApi.get(`/${urlInfo.type}s/${urlInfo.id}`);
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
                return { name: name.slice(0, 100), value: url };
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error) && error.response?.status === 404)
                    return { name: "Invalid Spotify URL", value: url };
                return { name: "Error fetching Spotify metadata", value: url };
            }
        };
        this.getSuggestions = async (query, options = {}) => {
            if (!query?.trim())
                return [];
            await this.checkToken();
            const maxResults = options.maxResults || this.defaultOptions.maxResults;
            try {
                if (query.startsWith("https://")) {
                    const metadata = await this.getMetadataFromUrl(query);
                    return [metadata];
                }
                const { data } = await this.spotifyApi.get("/search", { params: { q: query, type: "track", limit: maxResults } });
                return data.tracks.items.map((track) => ({
                    name: `${track.name} - ${track.artists[0].name}`.slice(0, 100),
                    value: track.external_urls.spotify,
                }));
            }
            catch (error) {
                this.client.logger.warn(`[AUTO_SEARCH] Spotify Autocomplete error: ${error}`);
                return [];
            }
        };
        this.client = client;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.defaultOptions = { maxResults: 7, language: "en" };
        this.spotifyApi = axios_1.default.create({
            baseURL: "https://api.spotify.com/v1",
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
        });
        this.authApi = axios_1.default.create({
            baseURL: "https://accounts.spotify.com/api",
            timeout: 10000,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        this.spotifyApi.interceptors.response.use((response) => response, async (error) => {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    await this.refreshToken();
                    const originalRequest = error.config;
                    if (originalRequest && originalRequest.headers) {
                        originalRequest.headers.Authorization = `Bearer ${this.token}`;
                        return this.spotifyApi(originalRequest);
                    }
                }
            }
            return Promise.reject(error);
        });
    }
    ;
}
exports.SpotifyAutoComplete = SpotifyAutoComplete;
;
