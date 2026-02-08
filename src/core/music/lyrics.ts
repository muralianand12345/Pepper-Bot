import axios from "axios";

import { LyricLine, LyricsResponse } from "../../types";

export class Lyrics {
    private baseUrl: string;

    constructor(baseUrl: string = "https://pepper-lyrics.onrender.com") {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    fetch = async (spotifyUrl: string): Promise<LyricsResponse> => {
        const { data } = await axios.get<LyricsResponse>(this.baseUrl, { params: { url: spotifyUrl } });
        if (data.error) throw new Error("Failed to fetch lyrics from provider");
        return data;
    };

    getLines = async (spotifyUrl: string): Promise<LyricLine[]> => {
        const response = await this.fetch(spotifyUrl);
        return response.lines.filter((line) => line.words.trim() !== "");
    };

    getPlainText = async (spotifyUrl: string): Promise<string> => {
        const lines = await this.getLines(spotifyUrl);
        return lines.map((line) => line.words).join("\n");
    };

    getSyncedLines = async (spotifyUrl: string): Promise<{ timeMs: number; words: string }[]> => {
        const lines = await this.getLines(spotifyUrl);
        return lines.map((line) => ({ timeMs: parseInt(line.startTimeMs, 10), words: line.words }));
    };
}
