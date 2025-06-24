import { Schema, model } from 'mongoose';

import { IRadioUser } from '../../../types';

const radioUserSchema = new Schema<IRadioUser>(
	{
		userId: { type: String, required: true, unique: true },
		favoriteStations: [{ type: String, required: true }],
		lastPlayedStation: { type: String, required: false },
		preferredCountries: [{ type: String, required: true }],
		preferredLanguages: [{ type: String, required: true }],
		recentStations: [{ type: String, required: true }],
	},
	{
		timestamps: true,
	}
);

export const radioUser = model('radio-users', radioUserSchema);
