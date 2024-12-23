import { Schema, model } from 'mongoose';
import { IMusicUser } from '../../../types';

const musicUserSchema = new Schema<IMusicUser>({
    userId: { type: String, required: true },
    songsNo: { type: Number, default: 0, required: false },
    songs: [{
        name: { type: String, required: false },
        url: { type: String, required: false },
        times: { type: Number, required: false },
    }]
});

export default model('music-user', musicUserSchema);