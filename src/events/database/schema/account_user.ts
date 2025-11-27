import mongoose from 'mongoose';

const userAccountSchema = new mongoose.Schema({
	userId: { type: String, required: true, unique: true },
	accounts: [
		{
			type: { type: String, required: true, enum: ['spotify'] },
			token: { access: { type: String, required: true }, refresh: { type: String, required: true } },
			username: { type: String, required: false },
		},
	],
}, { timestamps: true });

export default mongoose.model('account-users', userAccountSchema);