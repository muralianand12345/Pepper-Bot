export interface IPlayer {
    position: number;
    queue: {
        current: {
            duration: number;
        };
    };
}

export interface IAutoCompleteOptions {
    maxResults?: number;
    language?: string;
    client?: string;
}

export interface ISpotifySearchResult {
    tracks: {
        items: Array<{
            name: string;
            artists: Array<{ name: string }>;
            external_urls: { spotify: string };
        }>;
    };
}

export interface ITrackFormatOptions {
    maxTitleLength?: number;
    maxArtistLength?: number;
    includeDuration?: boolean;
}

export interface ILastFmTrack {
    name: string;
    playcount: number;
    match: number;
    url: string;
    artist: {
        name: string;
        url: string;
    };
}

export interface INodeOption {
    name: string;
    value: string;
}

export interface IFilterPreset {
    name: string;
    emoji: string;
    description: string;
}