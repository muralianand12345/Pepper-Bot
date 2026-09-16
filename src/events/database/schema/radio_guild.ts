import { Schema, model } from 'mongoose';

import { userDataSchema } from './index';
import { IRadioGuild, IRadioStationEntry } from '../../../types';

export const radioStationSchema = new Schema<IRadioStationEntry>(
	{
		stationId: { type: String, required: true },
		name: { type: String, required: true },
		genre: { type: String, required: false, default: 'Radio' },
		country: { type: String, required: false, default: null },
		url: { type: String, required: true },
		artworkUrl: { type: String, required: false, default: null },
		codec: { type: String, required: false, default: 'MP3' },
		bitrate: { type: Number, required: false, default: 0 },
		source: { type: String, enum: ['curated', 'radiobrowser'], required: true },
		played_number: { type: Number, default: 1, required: true },
		total_duration_ms: { type: Number, default: 0, required: true },
		reconnect_count: { type: Number, default: 0, required: true },
		failure_count: { type: Number, default: 0, required: true },
		last_requester: { type: userDataSchema, required: false },
		first_played: { type: Date, required: true },
		last_played: { type: Date, required: true },
	},
	{ _id: false },
);

const radioGuildSchema = new Schema<IRadioGuild>({
	guildId: { type: String, required: true },
	stations: [radioStationSchema],
	total_listen_ms: { type: Number, default: 0, required: true },
	total_sessions: { type: Number, default: 0, required: true },
});

radioGuildSchema.index({ guildId: 1 });
radioGuildSchema.index({ 'stations.played_number': -1 });
radioGuildSchema.index({ 'stations.total_duration_ms': -1 });
radioGuildSchema.index({ 'stations.last_played': -1 });
radioGuildSchema.index({ guildId: 1, 'stations.stationId': 1 });

export default model('radio-guilds', radioGuildSchema);
