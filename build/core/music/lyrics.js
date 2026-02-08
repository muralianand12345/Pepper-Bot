"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lyrics = void 0;
const axios_1 = __importDefault(require("axios"));
class Lyrics {
    constructor(baseUrl = 'https://pepper-lyrics.onrender.com') {
        this.fetch = async (spotifyUrl) => {
            const { data } = await axios_1.default.get(this.baseUrl, { params: { url: spotifyUrl } });
            if (data.error)
                throw new Error('Failed to fetch lyrics from provider');
            return data;
        };
        this.getLines = async (spotifyUrl) => {
            const response = await this.fetch(spotifyUrl);
            return response.lines.filter((line) => line.words.trim() !== '');
        };
        this.getPlainText = async (spotifyUrl) => {
            const lines = await this.getLines(spotifyUrl);
            return lines.map((line) => line.words).join('\n');
        };
        this.getSyncedLines = async (spotifyUrl) => {
            const lines = await this.getLines(spotifyUrl);
            return lines.map((line) => ({ timeMs: parseInt(line.startTimeMs, 10), words: line.words }));
        };
        this.baseUrl = baseUrl.replace(/\/+$/, '');
    }
}
exports.Lyrics = Lyrics;
