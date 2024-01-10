const { Schema, model } = require('mongoose');

const ticket = Schema({
    clientId: { type: String, required: true },
    restartCount: { type: Number, required: true },
    interactionCount: { type: Number, required: false },
    commandCount: { type: Number, required: false },
});

module.exports = model('bot-data', ticket);