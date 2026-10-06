import { Schema, model } from 'mongoose';

import { IUserBan } from '../../../types';

const userBanSchema = new Schema<IUserBan>(
	{
		userId: { type: String, required: true, unique: true },
		reason: { type: String, required: true },
		bannedBy: { type: String, required: false, default: null },
		expiresAt: { type: Date, required: false, default: null },
	},
	{ timestamps: true },
);

export default model('user-bans', userBanSchema);
