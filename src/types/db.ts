import mongoose from 'mongoose';

import { ISongs } from './music';

export interface IMusicGuild extends mongoose.Document {
	guildId: string;
	language?: string | null;
	dj: string | null;
	songs: Array<ISongs>;
}

export interface IMusicUser extends mongoose.Document {
	userId: string;
	language?: string | null;
	songs: Array<ISongs>;
}

export type PlaylistVisibility = 'private' | 'public';

export interface IPlaylistTrack {
	encoded: string;
	title: string;
	author: string;
	uri: string;
	identifier: string;
	sourceName: string;
	duration: number;
	isSeekable: boolean;
	isStream: boolean;
	isrc: string;
	artworkUrl: string | null;
	addedBy: string;
	addedAt: Date;
}

export interface IPlaylistTransfer {
	toUserId: string;
	expiresAt: Date;
}

export interface PlaylistRecord {
	code: string;
	ownerId: string;
	name: string;
	nameKey: string;
	visibility: PlaylistVisibility;
	tracks: Array<IPlaylistTrack>;
	transfer: IPlaylistTransfer | null;
	revision: number;
	playCount: number;
	lastPlayedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface PlaylistSummary {
	code: string;
	ownerId: string;
	name: string;
	visibility: PlaylistVisibility;
	trackCount: number;
	createdAt: Date;
}

export interface PlaylistPendingRecord {
	token: string;
	userId: string;
	code: string;
	tracks: Array<IPlaylistTrack>;
	expiresAt: Date;
}

export interface IMusicPlaylist extends mongoose.Document, PlaylistRecord {}

export interface IPlaylistPending extends mongoose.Document, PlaylistPendingRecord {}
