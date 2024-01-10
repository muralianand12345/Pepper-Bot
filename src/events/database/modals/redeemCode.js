const { Schema, model } = require('mongoose');

const createRedeem = Schema({
    code: { type: String, required: true, unique: true },
    expiresAt: { type: Number, default: null },
    plan: { type: String, default: null }
});

module.exports = model('redeemCode', createRedeem);