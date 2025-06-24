import mongoose from 'mongoose';

import { ISongs } from './music';

export interface IMusicGuild extends mongoose.Document {
	guildId: string;
	language?: string | null;
	songs: Array<ISongs>;
}

export interface IMusicUser extends mongoose.Document {
	userId: string;
	language?: string | null;
	songs: Array<ISongs>;
}

export interface IRadioUser extends mongoose.Document {
	userId: string;
	favoriteStations: string[];
	lastPlayedStation?: string;
	preferredCountries: string[];
	preferredLanguages: string[];
	recentStations: string[];
}

export interface IRadioGuild extends mongoose.Document {
	guildId: string;
	allowedLanguages: string[];
	defaultCountry?: string;
	maxBitrate?: number;
	favoriteStations: string[];
}
