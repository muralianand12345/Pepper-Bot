import discord from "discord.js";
import mongoose from "mongoose";
import magmastream from "magmastream";
import { CommandLogger } from "./utils/command_logger";

//-----------GLOBAL-----------//

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DEBUG_MODE: boolean | string;
            TOKEN: string;
            MONGO_URI: string;
            LASTFM_API_KEY: string;
            SPOTIFY_CLIENT_ID: string;
            SPOTIFY_CLIENT_SECRET: string;
            FEEDBACK_WEBHOOK: string;
        }
    }
}

declare module "discord.js" {
    export interface Client {
        slashCommands: discord.Collection<string, SlashCommand>;
        commands: discord.Collection<string, Command>;
        cooldowns: discord.Collection<string, number>;
        logger: ILogger;
        cmdLogger: typeof CommandLogger;
        config: IConfig;
        manager: magmastream.Manager;
    }
}

declare module "magmastream" {
    interface Player {
        cleanupScheduledAt?: number;
    }
}

//-----------EVENTS-----------//

export interface SlashCommand {
    data: typeof data;
    modal?: (
        interaction: discord.ModalSubmitInteraction<discord.CacheType>
    ) => void;
    userPerms?: Array<discord.PermissionResolvable>;
    botPerms?: Array<discord.PermissionResolvable>;
    cooldown?: number;
    owner?: boolean;
    premium?: boolean;
    execute: (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => void;
    autocomplete?: (
        interaction: discord.AutocompleteInteraction,
        client: discord.Client
    ) => void;
}

export interface Command {
    name: string;
    description: string;
    userPerms?: Array<discord.PermissionResolvable>;
    botPerms?: Array<discord.PermissionResolvable>;
    cooldown?: number;
    owner?: boolean;
    premium?: boolean;
    execute: (
        client: discord.Client,
        message: discord.Message,
        args: Array<string>
    ) => void;
}

export interface BotEvent {
    name: string;
    once?: boolean | false;
    execute: (...args) => void;
}

export interface LavalinkEvent {
    name: string;
    execute: (...args) => void;
}

//-----------YAML Config-----------//

export interface IConfig {
    bot: {
        owners: Array<string>;
        presence: {
            enabled: boolean;
            status: string;
            interval: number;
            activity: Array<BotPresence>;
        };
        command: {
            prefix: string;
            disable_message: boolean;
            cooldown_message: string;
            register_specific_commands: {
                enabled: boolean;
                commands: Array<string>;
            };
        };
        log: {
            command: string;
            server: string;
        };
    };
    music: {
        enabled: boolean;
        image: string;
        lavalink: {
            default_search: string;
            nodes: Array<{
                identifier: string;
                host: string;
                port: number;
                password: string;
                secure: boolean;
                retryAmount: number;
                retrydelay: number;
                resumeStatus: boolean;
                resumeTimeout: number;
            }>;
        };
    };
    content: {
        text: {
            no_music_playing: string;
        };
        embed: {
            color: {
                default: discord.ColorResolvable;
                success: discord.ColorResolvable;
                error: discord.ColorResolvable;
                info: discord.ColorResolvable;
                warning: discord.ColorResolvable;
            };
            no_music_playing: {
                color: discord.ColorResolvable | null;
                image: string;
                author: {
                    name: string;
                    icon_url: string;
                };
            };
        };
    };
    api?: {
        enabled: boolean;
        port: number;
        origin: Array<string>;
        auth: {
            enabled: boolean;
            apiKey: string;
        };
        rateLimit: {
            windowMs: number;
            max: number;
        };
    };
}

//-----------DB MODELS-----------//

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
    redeemedAt: date | null;
    expiresAt: date | null;
    plan: string | null;
}

export interface ISongsUser {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
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
    presence_song: boolean | null;
    timestamp: Date;
}

export interface IMusicUser extends mongoose.Document {
    userId: string;
    songs: Array<ISongs>;
}

export interface IMusicGuild extends mongoose.Document {
    guildId: string;
    songChannelId: string | null;
    songs: Array<ISongs>;
}

//---------API INTERFACE----------//

export interface WebSocketMessage {
    type: MessageType;
    data: {
        guildId?: string;
        query?: string;
        userId?: string;
        volume?: number;
        count?: number;
        apiKey?: string;
        [key: string]: any;
    };
}

export interface AuthConfig {
    enabled: boolean;
    apiKey: string;
}

export interface MusicDBSong {
    title: string;
    author: string;
    sourceName: string;
    uri: string;
    played_number: number;
    timestamp: Date;
    artworkUrl?: string;
    thumbnail?: string;
}

export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: 'timestamp' | 'playCount';
    sortDirection?: 'desc' | 'asc';
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface SortInfo {
    by: 'timestamp' | 'playCount';
    direction: 'desc' | 'asc';
}

//--------------------------------//

export interface ILogger {
    success(message: string | Error): void;
    log(message: string | Error): void;
    error(message: string | Error): void;
    warn(message: string | Error): void;
    info(message: string | Error): void;
    debug(message: string | Error): void;
}

export interface ICommandLogger {
    client: discord.Client;
    commandName: string;
    guild: discord.Guild | null;
    user: discord.User | null;
    channel: discord.TextChannel | null;
}

export interface CommandInfo {
    name: string;
    description: string;
}

export interface BotPresence {
    name: string;
    type: discord.ActivityType;
}

export interface IPlayer {
    position: number;
    queue: {
        current: {
            duration: number;
        };
    };
}

export interface IAutoCompleteOptions {
    maxResults?: number;
    language?: string;
    client?: string;
}

export interface SpotifySearchResult {
    tracks: {
        items: Array<{
            name: string;
            artists: Array<{ name: string }>;
            external_urls: { spotify: string };
        }>;
    };
}

export interface ITrackFormatOptions {
    maxTitleLength?: number;
    maxArtistLength?: number;
    includeDuration?: boolean;
}

export interface ILastFmTrack {
    name: string;
    playcount: number;
    match: number;
    url: string;
    artist: {
        name: string;
        url: string;
    };
}

export interface INodeOption {
    name: string;
    value: string;
}

