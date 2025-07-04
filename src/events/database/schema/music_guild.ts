import { Schema, model } from 'mongoose';

import { userDataSchema } from './index';
import { IMusicGuild } from '../../../types';

const musicGuildSchema = new Schema<IMusicGuild>({
	guildId: { type: String, required: true },
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

export default model('music-guild', musicGuildSchema);
