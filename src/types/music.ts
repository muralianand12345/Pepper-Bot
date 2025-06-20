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

export interface INodeOption {
	name: string;
	value: string;
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

export interface ICacheEntry {
	data: any;
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

export interface IXPAction {
	type: 'listen' | 'command' | 'queue_add' | 'playlist_add' | 'share' | 'recommend';
	xpGained: number;
	timestamp: Date;
	details?: string;
}

export interface ILevelInfo {
	currentLevel: number;
	currentXP: number;
	xpForCurrentLevel: number;
	xpForNextLevel: number;
	xpToNextLevel: number;
	progress: number;
}

export interface ILeaderboardEntry {
	userId: string;
	username: string;
	avatar?: string;
	totalXP: number;
	currentLevel: number;
	rank: number;
	guildId?: string;
}

export interface IUserStats {
	totalXP: number;
	currentLevel: number;
	dailyXP: number;
	weeklyXP: number;
	monthlyXP: number;
	streakDays: number;
	totalListeningTime: number;
	totalSongs: number;
	favoriteGenre: string;
	globalRank: number;
	guildRank?: number;
}
