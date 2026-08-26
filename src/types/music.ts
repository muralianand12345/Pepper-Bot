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

export interface LyricLine {
	startTimeMs: string;
	words: string;
	syllables: string[];
	endTimeMs: string;
	transliteratedWords: string;
}

export interface LyricsResponse {
	error: boolean;
	syncType: 'LINE_SYNCED' | 'UNSYNCED' | string;
	lines: LyricLine[];
}

export interface StatsRealtimeTrack {
	guildId: string;
	guildName: string | null;
	voiceChannelId: string | null;
	listeners: number;
	playing: boolean;
	paused: boolean;
	position: number;
	queueSize: number;
	title: string;
	author: string;
	uri: string;
	duration: number;
	artworkUrl: string | null;
	sourceName: string;
	requester: ISongsUser | null;
	shardId: number;
}

export interface StatsRealtime {
	players: number;
	playing: number;
	paused: number;
	idle: number;
	listeners: number;
	guilds: number;
	members: number;
	channels: number;
	shards: number;
	uptime: number;
	nowPlaying: StatsRealtimeTrack[];
}

export interface StatsOverview {
	uniqueSongs: number;
	totalPlays: number;
	uniqueArtists: number;
	estimatedPlaytimeMs: number;
	activeGuilds: number;
	trackedListeners: number;
	songsLastPlayed24h: number;
	songsLastPlayed7d: number;
	lastPlayedAt: Date | null;
}

export interface StatsTopRequester {
	rank: number;
	userId: string;
	username: string | null;
	avatar: string | null;
	totalPlays: number;
	uniqueSongs: number;
	uniqueArtists: number;
	estimatedPlaytimeMs: number;
	lastPlayedAt: Date | null;
}

export interface StatsServerPlaytime {
	guildId: string;
	guildName: string | null;
	estimatedPlaytimeMs: number;
	totalPlays: number;
	uniqueSongs: number;
}

export interface StatsPlaytime {
	estimatedPlaytimeMs: number;
	totalPlays: number;
	trackedGuilds: number;
	servers: StatsServerPlaytime[];
}

export interface StatsServerTopSong {
	title: string;
	author: string;
	uri: string;
	artworkUrl: string | null;
	plays: number;
}

export interface StatsServerInsight {
	guildId: string;
	guildName: string | null;
	guildIcon: string | null;
	memberCount: number | null;
	totalPlays: number;
	uniqueSongs: number;
	uniqueArtists: number;
	estimatedPlaytimeMs: number;
	averagePlaysPerSong: number;
	sources: string[];
	topSong: StatsServerTopSong | null;
	lastPlayedAt: Date | null;
	live: boolean;
}

export interface StatsGuildMeta {
	name: string | null;
	icon: string | null;
	memberCount: number | null;
}
