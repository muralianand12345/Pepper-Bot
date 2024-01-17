const { Schema, model } = require('mongoose');

const music = Schema({
    guildID: { type: String, required: true },
    musicChannel: { type: String, required: false },
    musicPannelId: { type: String, required: false },
    status247: { type: Boolean, default: false, required: false }
});

module.exports = model('music-guild', music);