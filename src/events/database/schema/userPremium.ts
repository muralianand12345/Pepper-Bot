import { Schema, model } from 'mongoose';
import { IUserPremium } from '../../../types';

const userPremiumSchema = new Schema<IUserPremium>({
    userId: { type: String, required: true, unique: true },
    isPremium: { type: Boolean, default: false },
    premium: {
        redeemedBy: { type: String, default: null },
        redeemedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
        plan: { type: String, default: null }
    }
});

export default model('premium', userPremiumSchema);