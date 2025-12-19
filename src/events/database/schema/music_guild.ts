import { Schema, model } from 'mongoose';

import { userDataSchema } from './index';
import { IMusicGuild } from '../../../types';

const musicGuildSchema = new Schema<IMusicGuild>({
	guildId: { type: String, required: true },
	language: { type: String, required: false, default: null },
	dj: { type: String, required: false, default: null, set: (v: string | null | undefined) => (typeof v === 'string' || v === null || v === undefined ? v : null) },
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

musicGuildSchema.pre('validate', async function () {
	if (this.dj !== null && typeof this.dj !== 'string') this.dj = null;
});

musicGuildSchema.pre('save', async function () {
	if (this.dj !== null && typeof this.dj !== 'string') this.dj = null;
});

musicGuildSchema.index({ guildId: 1 });
musicGuildSchema.index({ 'songs.played_number': -1 });
musicGuildSchema.index({ 'songs.uri': 1 });
musicGuildSchema.index({ 'songs.timestamp': -1 });
musicGuildSchema.index({ 'songs.author': 1 });
musicGuildSchema.index({ 'songs.timestamp': -1, 'songs.played_number': -1 });
musicGuildSchema.index({ guildId: 1, 'songs.uri': 1 });
musicGuildSchema.index({ guildId: 1, 'songs.played_number': -1 });

export default model('music-guilds', musicGuildSchema);
