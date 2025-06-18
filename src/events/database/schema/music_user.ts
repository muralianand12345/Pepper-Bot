import { Schema, model } from 'mongoose';

import { userDataSchema } from './index';
import { IMusicUser } from '../../../types';

const musicUserSchema = new Schema<IMusicUser>({
	userId: { type: String, required: true },
	language: { type: String, required: false, default: null },
	lavalink: {
		host: { type: String, required: false },
		port: { type: Number, required: false },
		password: { type: String, required: false },
		secure: { type: Boolean, required: false, default: false },
		identifier: { type: String, required: false },
		autoFallback: { type: Boolean, required: false, default: true },
		retryCount: { type: Number, required: false, default: 0 },
		isActive: { type: Boolean, required: false, default: false },
		lastError: { type: String, required: false },
		addedAt: { type: Date, required: false },
	},
	songs: [
		{
			track: { type: String, required: true },
			artworkUrl: { type: String, required: true },
			sourceName: { type: String, required: true },
			title: { type: String, required: true },
			identifier: { type: String, required: true },
			author: { type: String, required: true },
			duration: { type: Number, required: true },
			isrc: { type: String, required: false, default: '' },
			isSeekable: { type: Boolean, required: true },
			isStream: { type: Boolean, required: true },
			uri: { type: String, required: true },
			thumbnail: { type: String, required: false },
			requester: { type: userDataSchema, required: false },
			played_number: { type: Number, default: 1, required: true },
			timestamp: { type: Date, required: true },
		},
	],
});

export default model('music-users', musicUserSchema);
