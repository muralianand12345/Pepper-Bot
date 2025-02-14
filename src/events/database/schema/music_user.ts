import { Schema, model } from "mongoose";
import { IMusicUser } from "../../../types";

const musicUserSchema = new Schema<IMusicUser>({
    userId: { type: String, required: true },
    songs: [
        {
            title: { type: String, required: true },
            url: { type: String, required: true },
            played_number: { type: Number, default: 1 },
            timestamp: { type: Date, default: Date.now },
        },
    ],
});

export default model("music-users", musicUserSchema);
