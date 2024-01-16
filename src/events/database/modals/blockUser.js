const { Schema, model } = require('mongoose');

const blockUser = Schema({
    userId: { type: String, required: true },
    status: { type: Boolean, required: true },
    data: [{
        reason: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
    }],
});

module.exports = model('blocked-user', blockUser);