import { Schema, model } from 'mongoose';

import { userDataSchema } from './index';
import { IMusicUser } from '../../../types';

const musicUserSchema = new Schema<IMusicUser>({
	userId: { type: String, required: true },
	language: { type: String, required: false, default: null },
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

musicUserSchema.index({ userId: 1 });
musicUserSchema.index({ 'songs.played_number': -1 });
musicUserSchema.index({ 'songs.uri': 1 });
musicUserSchema.index({ 'songs.timestamp': -1 });
musicUserSchema.index({ userId: 1, 'songs.uri': 1 });
musicUserSchema.index({ userId: 1, 'songs.played_number': -1 });

export default model('music-users', musicUserSchema);
