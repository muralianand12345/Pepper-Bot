import mongoose from 'mongoose';

import { ISongsUser } from './music';

export type RadioSource = 'curated' | 'radiobrowser';

export interface RadioStation {
	id: string;
	name: string;
	genre: string;
	country: string | null;
	url: string;
	codec: string;
	bitrate: number;
	artworkUrl: string | null;
	homepage: string | null;
	source: RadioSource;
}

export interface RadioSearchOptions {
	countryCode?: string | null;
	limit?: number;
}

export type RadioSearchStatus = 'ok' | 'empty' | 'frequency_empty';

export interface RadioSearchResult {
	status: RadioSearchStatus;
	stations: RadioStation[];
}

export interface IRadioBrowserStation {
	stationuuid: string;
	name: string;
	url: string;
	url_resolved: string;
	homepage: string;
	favicon: string;
	tags: string;
	country: string;
	countrycode: string;
	state: string;
	language: string;
	votes: number;
	codec: string;
	bitrate: number;
	hls: number;
	lastcheckok: number;
	clickcount: number;
	ssl_error: number;
}

export interface IRadioBrowserServer {
	ip: string;
	name: string;
}

export interface RadioState {
	station: RadioStation;
	startedAt: number;
	lastFlushAt: number;
	requesterId: string | null;
	reconnects: number;
	lastReconnectAt: number;
}

export interface IRadioStationEntry {
	stationId: string;
	name: string;
	genre: string;
	country: string | null;
	url: string;
	artworkUrl: string | null;
	codec: string;
	bitrate: number;
	source: RadioSource;
	played_number: number;
	total_duration_ms: number;
	reconnect_count: number;
	failure_count: number;
	last_requester?: ISongsUser | null;
	first_played: Date;
	last_played: Date;
}

export interface IRadioGuild extends mongoose.Document {
	guildId: string;
	stations: Array<IRadioStationEntry>;
	total_listen_ms: number;
	total_sessions: number;
}

export interface IRadioUser extends mongoose.Document {
	userId: string;
	stations: Array<IRadioStationEntry>;
	total_listen_ms: number;
	total_sessions: number;
}

export interface RadioTopStation {
	rank: number;
	stationId: string;
	name: string;
	genre: string;
	country: string | null;
	artworkUrl: string | null;
	source: RadioSource;
	playCount: number;
	totalDurationMs: number;
	lastPlayed: Date;
}

export interface RadioSummary {
	uniqueStations: number;
	totalPlays: number;
	totalListenMs: number;
	totalSessions: number;
	topGenre: string | null;
	countries: number;
}
