import discord from "discord.js";
import { IAutoCompleteOptions, SpotifySearchResult } from "../types";

export class SpotifyAutoComplete {
    private token: string | null = null;
    private tokenExpiry: number = 0;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly defaultOptions: IAutoCompleteOptions;

    constructor(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.defaultOptions = {
            maxResults: 7,
            language: "en",
        };
    }

    private refreshToken = async (): Promise<void> => {
        const auth = Buffer.from(
            `${this.clientId}:${this.clientSecret}`
        ).toString("base64");
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.statusText}`);
        }

        const data = await response.json();
        this.token = data.access_token;
        this.tokenExpiry = Date.now() + data.expires_in * 1000;
    };

    private checkToken = async (): Promise<void> => {
        if (!this.token || Date.now() >= this.tokenExpiry) {
            await this.refreshToken();
        }
    };

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

    private getMetadataFromUrl = async (
        url: string
    ): Promise<discord.ApplicationCommandOptionChoiceData> => {
        await this.checkToken();

        const urlInfo = this.getSpotifyIdFromUrl(url);
        if (!urlInfo) {
            return { name: url, value: url };
        }

        try {
            const response = await fetch(
                `https://api.spotify.com/v1/${urlInfo.type}s/${urlInfo.id}`,
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                }
            );

            if (!response.ok) {
                return { name: "Invalid Spotify URL", value: url };
            }

            const data = await response.json();
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
            return { name: "Error fetching Spotify metadata", value: url };
        }
    };

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

            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(
                    query
                )}&type=track&limit=${maxResults}`,
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                }
            );

            if (!response.ok)
                throw new Error(`Search failed: ${response.statusText}`);

            const data = (await response.json()) as SpotifySearchResult;
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
