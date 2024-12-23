import { Schema, model } from 'mongoose';
import { IMusicGuild } from '../../../types';

const musicGuildSchema = new Schema<IMusicGuild>({
    guildId: { type: String, required: true },
    musicChannel: { type: String, required: true },
    musicPannelId: { type: String, required: true },
    status247: { type: Boolean, default: false, required: true },
    songsNo: { type: Number, default: 0, required: false },
    songs: [{
        name: { type: String, required: false },
        url: { type: String, required: false },
        times: { type: Number, required: false },
    }]
});

export default model('music-guild', musicGuildSchema);