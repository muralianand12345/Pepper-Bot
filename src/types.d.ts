import discord from "discord.js";
import mongoose from "mongoose";
import { Manager } from "magmastream";
import { CommandLogger } from "./utils/command_logger";

//Global
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TOKEN: string;
            MONGO_URI: string;
            DEBUG_MODE: boolean | string;
        }
    }
}

//Utils

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

//Config

export interface IConfig {
    bot: IBotConfig;
    music: IMusicConfig;
    content: IContentConfig;
}

// ------

export interface IBotConfig {
    owners: Array<string>;
    presence: IPresenceConfig;
    command: ICommandConfig;
    log: ILogConfig;
}

export interface IMusicConfig {
    enabled: boolean;
    image: string;
    lavalink: ILavalinkConfig;
}

export interface IContentConfig {
    text: ITextConfig;
    embed: IEmbedConfig;
}

// ------

export interface ICommandConfig {
    prefix: string;
    disable_message: boolean;
    cooldown_message: string;
    register_specific_commands: IRegisterSpecificCommandsConfig;
}

export interface IPresenceConfig {
    enabled: boolean;
    status: string;
    interval: number;
    activity: Array<BotPresence>;
}

export interface ILogConfig {
    command: string;
    server: string;
}

export interface ILavalinkConfig {
    default_search: string;
    nodes: Array<ILavalinkNodeConfig>;
}

export interface ITextConfig {
    no_music_playing: string;
}

export interface IEmbedConfig {
    color: IDiscordColorConfig;
    no_music_playing: INoMusicPlayingEmbedConfig;
}

// ------

export interface IRegisterSpecificCommandsConfig {
    enabled: boolean;
    commands: Array<string>;
}

export interface ILavalinkNodeConfig {
    identifier: string;
    host: string;
    port: number;
    password: string;
    secure: boolean;
    retryAmount: number;
    retrydelay: number;
    resumeStatus: boolean;
    resumeTimeout: number;
}

export interface IDiscordColorConfig {
    default: discord.ColorResolvable;
    success: discord.ColorResolvable;
    error: discord.ColorResolvable;
    info: discord.ColorResolvable;
    warning: discord.ColorResolvable;
}

export interface INoMusicPlayingEmbedConfig {
    color: discord.ColorResolvable | nul;
    image: string;
    author: {
        name: string;
        icon_url: string;
    };
}

//Client

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

export interface CommandInfo {
    name: string;
    description: string;
}

declare module "discord.js" {
    export interface Client {
        slashCommands: discord.Collection<string, SlashCommand>;
        commands: discord.Collection<string, Command>;
        cooldowns: discord.Collection<string, number>;
        logger: ILogger;
        cmdLogger: typeof CommandLogger;
        config: IConfig;
        manager: Manager;
    }
}

export interface BotPresence {
    name: string;
    type: discord.ActivityType;
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

export interface SpotifySearchResult {
    tracks: {
        items: Array<{
            name: string;
            artists: Array<{ name: string }>;
            external_urls: { spotify: string };
        }>;
    };
}

// Models

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

export interface ISongs {
    title: string;
    url: string;
    played_number: number;
    timestamp: Date;
}

export interface IMusicUser {
    userId: string;
    songs: Array<ISongs>;
}
