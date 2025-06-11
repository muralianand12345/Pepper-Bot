import { Schema } from "mongoose";

import { ISongsUser } from "../../../types";


export const userDataSchema = new Schema<ISongsUser>({
    id: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    avatar: { type: String, required: false },
});