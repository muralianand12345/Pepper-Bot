import mongoose from 'mongoose';

import { ISongs } from './music';

export interface IMusicGuild extends mongoose.Document {
	guildId: string;
	language?: string | null;
	dj: string | null;
	twentyFourSeven?: boolean;
	songs: Array<ISongs>;
}

export interface IMusicUser extends mongoose.Document {
	userId: string;
	language?: string | null;
	songs: Array<ISongs>;
}
