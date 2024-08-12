import { Schema, model } from 'mongoose';
import { IRedeemCode } from '../../../types';

const redeemCodeSchema = new Schema<IRedeemCode>({
    code: { type: String, required: true, unique: true },
    expiresAt: { type: Date, default: null },
    plan: { type: String, default: null }
});

export default model('redeemCode', redeemCodeSchema);