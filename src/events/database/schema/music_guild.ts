import { Schema, model } from "mongoose";
import { ISongsUser, IMusicGuild, IDJUser } from "../../../types";

const userDataSchema = new Schema<ISongsUser>({
    id: { type: String, required: true },
    username: { type: String, required: true },
    discriminator: { type: String, required: true },
    avatar: { type: String, required: false },
});

const djDataSchema = new Schema<IDJUser>({
    enabled: { type: Boolean, required: true, default: false },
    roleId: { type: String, required: false },
    auto: {
        assign: { type: Boolean, required: true, default: true },
        timeout: { type: Number, required: true, default: 86400000 }, 
    },
    users: {
        currentDJ: {
            userId: { type: String, required: false, default: null },
            username: { type: String, required: false, default: null },
            assignedAt: { type: Date, required: false, default: null },
            expiresAt: { type: Date, required: false, default: null },
        },
        previousDJs: [
            {
                userId: { type: String, required: true },
                username: { type: String, required: true },
                assignedAt: { type: Date, required: true },
                expiresAt: { type: Date, required: true },
            },
        ],
    },
});

const musicGuildSchema = new Schema<IMusicGuild>({
    guildId: { type: String, required: true },
    prefix: { type: String, required: false, default: "!" },
    musicPannelId: { type: String, required: false },
    songChannelId: { type: String, default: null },
    dj: {
        type: djDataSchema, required: false, default: () => ({
            enabled: false,
            roleId: null,
            auto: {
                assign: true,
                timeout: 86400000, // 24 hours
            },
            users: {
                currentDJ: null,
                previousDJs: []
            }
        })
    },
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

export default model("music-guild", musicGuildSchema);