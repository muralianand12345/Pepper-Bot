import mongoose from 'mongoose';

import { ISongs } from './music';

export interface IUserLavalink {
	host?: string;
	port?: number;
	password?: string;
	secure?: boolean;
	identifier?: string;
	autoFallback?: boolean;
	retryCount?: number;
	isActive?: boolean;
	lastError?: string;
	addedAt?: Date;
}

export interface IMusicGuild extends mongoose.Document {
	guildId: string;
	language?: string | null;
	songs: Array<ISongs>;
}

export interface IMusicUser extends mongoose.Document {
	userId: string;
	language?: string | null;
	lavalink?: IUserLavalink;
	songs: Array<ISongs>;
}
