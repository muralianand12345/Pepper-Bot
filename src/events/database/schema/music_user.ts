import { Schema, model } from "mongoose";
import { ISongsUser, IMusicUser } from "../../../types";

const userDataSchema = new Schema<ISongsUser>({
    id: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    avatar: { type: String, required: false },
});

const musicUserSchema = new Schema<IMusicUser>({
    userId: { type: String, required: true },
    spotify_presence: { type: Boolean, default: true, required: true },
    songs: [
        {
            track: { type: String, required: true },
            artworkUrl: { type: String, required: true },
            sourceName: { type: String, required: true },
            title: { type: String, required: true },
            identifier: { type: String, required: true },
            author: { type: String, required: true },
            duration: { type: Number, required: true },
            isrc: { type: String, required: false, default: "" },
            isSeekable: { type: Boolean, required: true },
            isStream: { type: Boolean, required: true },
            uri: { type: String, required: true },
            thumbnail: { type: String, required: false },
            requester: { type: userDataSchema, required: false },
            played_number: { type: Number, default: 1, required: true },
            timestamp: { type: Date, required: true },
        },
    ],
});

export default model("music-users", musicUserSchema);
