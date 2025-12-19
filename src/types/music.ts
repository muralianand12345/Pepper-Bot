import magmastream from 'magmastream';

export interface ISongsUser {
	id: string;
	username: string;
	discriminator: string;
	avatar?: string;
}

export interface ISongs {
	track: string;
	artworkUrl: string;
	sourceName: magmastream.TrackSourceName;
	title: string;
	identifier: string;
	author: string;
	duration: number;
	isrc: string;
	isSeekable: boolean;
	isStream: boolean;
	uri: string;
	thumbnail: string | null;
	requester?: ISongsUser | null;
	played_number: number;
	timestamp: Date;
}

export interface ITrackProgress {
	displayPosition: number;
	percentage: number;
	formattedPosition: string;
	formattedDuration: string;
}

export interface ChartAnalytics {
	totalSongs: number;
	uniqueArtists: number;
	totalPlaytime: number;
	topGenres: { [key: string]: number };
	recentActivity: number;
	averagePlayCount: number;
}

export interface ProgressComputation {
	displayPosition: number;
	percentage: number;
	formattedPosition: string;
	formattedDuration: string;
	bar: string;
}

export interface PlaylistItem {
	name: string;
	value: string;
}

export interface PlaylistResponse {
	playlists: PlaylistItem[];
	hasMore: boolean;
	nextOffset: number;
}

export interface StatusUpdate {
	voiceChannelId: string;
	status: string | null;
	resolve: (value: boolean) => void;
	timestamp: number;
}

// Spotify Types
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

export interface ICacheEntry<T = unknown> {
	data: T;
	timestamp: number;
	lastAccessed: number;
	ttl: number;
}

export interface ICacheConfig {
	enabled: boolean;
	maxSize: number;
	defaultSearchTTL: number;
	defaultUrlTTL: number;
	cleanupInterval: number;
}

export interface SpotifyTokens {
	access: string;
	refresh: string;
}

export interface SpotifyPlaylistOwner {
	id: string;
	display_name?: string;
}

export interface SpotifyPlaylistItem {
	name: string;
	owner: SpotifyPlaylistOwner;
	external_urls: {
		spotify: string;
	};
}

export interface SpotifyPlaylistsResponse {
	items: SpotifyPlaylistItem[];
	next: string | null;
}

export interface SpotifyUserProfile {
	id: string;
	display_name?: string;
}
