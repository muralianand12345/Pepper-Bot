import mongoose from 'mongoose';

const userAccountSchema = new mongoose.Schema(
	{
		userId: { type: String, required: true, unique: true },
		accounts: [
			{
				type: { type: String, required: true, enum: ['spotify'] },
				spotifyId: { type: String, required: false },
				token: { access: { type: String, required: false }, refresh: { type: String, required: false } },
				username: { type: String, required: false },
			},
		],
	},
	{ timestamps: true },
);

export default mongoose.model('account-users', userAccountSchema);
