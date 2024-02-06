const { Schema, model } = require('mongoose');

const userPlayList = Schema({
    userId: { type: String, required: true },
    playlist: [{
        name: { type: String, required: true },
        active: { type: Boolean, required: true },
        songs: [{
            name: { type: String, required: true },
            url: { type: String, required: true }
        }],
    }]
});

module.exports = model('user-playlist', userPlayList);