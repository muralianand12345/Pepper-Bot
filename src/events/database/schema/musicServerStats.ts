import { Schema, model } from 'mongoose';
import { IMusicServerStats } from '../../../types';

const musicServerStatsSchema = new Schema<IMusicServerStats>({
    guildId: { type: String, required: true },
    songsNo: { type: Number, default: 0, required: false },
    songs: [{
        name: { type: String, required: false },
        url: { type: String, required: false },
        times: { type: Number, required: false },
    }]
});

export default model('music-server-stats', musicServerStatsSchema);