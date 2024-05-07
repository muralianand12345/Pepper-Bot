import { Schema, model } from "mongoose";
import { ICustomPlaylist } from "../../../types";

const customPlaylistSchema = new Schema<ICustomPlaylist>({
    userId: { type: String, required: true },
    playlist: [{
        name: { type: String, required: true },
        songs: [{
            title: { type: String, required: true },
            url: { type: String, required: true },
        }]
    }]
});

export default model('custom-playlist', customPlaylistSchema);