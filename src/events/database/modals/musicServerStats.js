const { Schema, model } = require('mongoose');

const music = Schema({
    guildID: { type: String, required: true },
    songsNo: { type: Number, default: 0, required: false },
    songs: [{
        name: { type: String, required: false },
        url: { type: String, required: false },
        times: { type: Number, required: false },
    }]
});

module.exports = model('music-server-stats', music);