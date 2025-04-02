import { Schema, model } from "mongoose";
import { ISongsUser, IMusicGuild } from "../../../types";

const userDataSchema = new Schema<ISongsUser>({
    id: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    avatar: { type: String, required: false },
});

const musicGuildSchema = new Schema<IMusicGuild>({
    guildId: { type: String, required: true },
    songChannelId: { type: String, default: null },
    songs: [
        {
            track: { type: String, required: true },
            artworkUrl: { type: String, required: true },
            sourceName: { type: String, required: true },
            title: { type: String, required: true },
            identifier: { type: String, required: true },
            author: { type: String, required: true },
            duration: { type: Number, required: true },
            isrc: { type: String, required: true },
            isSeekable: { type: Boolean, required: true },
            isStream: { type: Boolean, required: true },
            uri: { type: String, required: true },
            thumbnail: { type: String, required: false },
            requester: { type: userDataSchema, required: false },
            played_number: { type: Number, default: 1, required: true },
            presence_song: { type: Boolean, default: false, required: false },
            timestamp: { type: Date, required: true },
        },
    ],
});

export default model("music-guild", musicGuildSchema);
