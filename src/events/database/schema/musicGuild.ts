import { Schema, model } from 'mongoose';
import { IMusicGuild } from '../../../types';

const musicGuildSchema = new Schema<IMusicGuild>({
    guildId: { type: String, required: true },
    musicChannel: { type: String, required: true },
    musicPannelId: { type: String, required: true },
    status247: { type: Boolean, default: false, required: true }
});

export default model('music-guild', musicGuildSchema);