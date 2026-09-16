import { Schema, model } from 'mongoose';

import { IRadioUser } from '../../../types';
import { radioStationSchema } from './radio_guild';

const radioUserSchema = new Schema<IRadioUser>({
	userId: { type: String, required: true },
	stations: [radioStationSchema],
	total_listen_ms: { type: Number, default: 0, required: true },
	total_sessions: { type: Number, default: 0, required: true },
});

radioUserSchema.index({ userId: 1 });
radioUserSchema.index({ 'stations.played_number': -1 });
radioUserSchema.index({ 'stations.total_duration_ms': -1 });
radioUserSchema.index({ userId: 1, 'stations.stationId': 1 });

export default model('radio-users', radioUserSchema);
