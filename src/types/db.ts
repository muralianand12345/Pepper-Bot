import mongoose from "mongoose";
import magmastream from "magmastream";


export interface IBlockUser extends mongoose.Document {
    userId: string;
    status: boolean;
    data: Array<IBlockUserData>;
}

export interface IBlockUserData {
    reason: string;
    date: Date;
}

export interface IUserPremium extends mongoose.Document {
    userId: string;
    isPremium: boolean;
    premium: IPremiumData;
}

export interface IPremiumData {
    redeemedBy: string | null;
    redeemedAt: Date | null;
    expiresAt: Date | null;
    plan: string | null;
}

export interface ISongsUser {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
}

export interface IDJUser {
    enabled: boolean;
    roleId: string | null;
    auto: {
        assign: boolean;
        timeout: number;
    },
    users: {
        currentDJ: {
            userId: string | null;
            username: string | null;
            assignedAt: Date | null;
            expiresAt: Date | null;
        } | null,
        previousDJs: Array<{
            userId: string;
            username: string;
            assignedAt: Date;
            expiresAt: Date;
        }>;
    }
}

export interface ISongs {
    track: string;
    artworkUrl: string;
    sourceName: magmastream.TrackSourceName;
    title: string;
    identifier: string;
    author: string;
    duration: number;
    isrc: string;
    isSeekable: boolean;
    isStream: boolean;
    uri: string;
    thumbnail: string | null;
    requester?: ISongsUser | null;
    played_number: number;
    timestamp: Date;
}

export interface IMusicUser extends mongoose.Document {
    userId: string;
    spotify_presence: boolean;
    songs: Array<ISongs>;
}

export interface IMusicGuild extends mongoose.Document {
    guildId: string;
    prefix: string | null;
    musicPannelId: string | null;
    songChannelId: string | null;
    dj: IDJUser;
    songs: Array<ISongs>;
}