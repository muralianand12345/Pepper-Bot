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

    public getSuggestions = async (
        query: string,
        options: IAutoCompleteOptions = {}
    ): Promise<discord.ApplicationCommandOptionChoiceData[]> => {
        if (!query?.trim()) return [];

        await this.checkToken();
        const maxResults = options.maxResults || this.defaultOptions.maxResults;

        try {
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
