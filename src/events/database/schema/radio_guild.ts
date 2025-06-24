import { Schema, model } from 'mongoose';

import { IRadioGuild } from '../../../types';

const radioGuildSchema = new Schema<IRadioGuild>(
	{
		guildId: { type: String, required: true, unique: true },
		allowedLanguages: [{ type: String, required: true }],
		defaultCountry: { type: String, required: false },
		maxBitrate: { type: Number, required: false, default: 320 },
		favoriteStations: [{ type: String, required: true }],
	},
	{
		timestamps: true,
	}
);

export const radioGuild = model('radio-guilds', radioGuildSchema);
