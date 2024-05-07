import { Client, SlashCommandBuilder, CommandInteraction, Collection, PermissionResolvable, Message, AutocompleteInteraction, ChatInputCommandInteraction, ActivityType, Channel } from "discord.js"
import mongoose from "mongoose"
import { Manager } from './module/magmastream';
import discord from "discord.js"

import logger from "./module/logger";
import * as cmdLogger from './module/commandLog';

// Commands ===============================================

export interface SlashCommand {
    data: typeof data,
    modal?: (interaction: ModalSubmitInteraction<CacheType>) => void,
    userPerms?: Array<PermissionResolvable>,
    botPerms?: Array<PermissionResolvable>,
    cooldown?: number,
    owner?: boolean,
    premium?: boolean,
    execute: (interaction: ChatInputCommandInteraction, client: Client) => void,
    autocomplete?: (interaction: AutocompleteInteraction, client: Client) => void,
}

export interface Command {
    name: string,
    description: string,
    userPerms?: Array<PermissionResolvable>,
    botPerms?: Array<PermissionResolvable>,
    cooldown?: number,
    owner?: boolean,
    premium?: boolean,
    execute: (client: Client, message: Message, args: Array<string>) => void
}

// Others ===============================================

//Voice State
export interface StateChange {
    type?: string;
    channel?: Channel;
    members?: any;
}

//discord Presence
export interface Activity {
    name: string,
    type: ActivityType
}

//discord events / exports
export type GuildOption = keyof GuildOptions
export interface BotEvent {
    name: string,
    once?: boolean | false,
    execute: (...args?) => void
}

//env
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TOKEN: string,
            PREFIX: string,
            MONGO_URI: string,
            MONGO_DATABASE_NAME: string
        }
    }
}

// Discord Client ===============================================

declare module "discord.js" {
    export interface Client {
        slashCommands: Collection<string, SlashCommand>
        commands: Collection<string, Command>,
        cooldowns: Collection<string, number>,
        logger: typeof logger,
        cmdLogger: typeof cmdLogger,
        config: any,
        manager: Manager,
        discord: typeof discord
    }
}

// DB Schema ===============================================

export interface IBotDataAnalysis extends mongoose.Document {
    clientId: string,
    restartCount: number,
    interactionCount: number,
    commandCount: number,
    server: Array<IServer>
}

export interface IBlockUser extends mongoose.Document {
    userId: string,
    status: boolean,
    data: Array<IBlockUserData>
}

export interface IMusicGuild extends mongoose.Document {
    guildId: string,
    musicChannel: string,
    musicPannelId: string,
    status247: boolean
}

export interface IMusicServerStats extends mongoose.Document {
    guildId: string,
    songsNo: number,
    songs: Array<IMusicServerStatsData>
}

export interface IMusicUser extends mongoose.Document {
    userId: string,
    songsNo: number,
    songs: Array<IMusicUserStatsData>
}

export interface IRedeemCode extends mongoose.Document {
    code: string,
    expiresAt: date
    plan: string
}

export interface IUserPremium extends mongoose.Document {
    userId: string,
    isPremium: boolean,
    premium: IPremiumData
}

export interface IPremiumData {
    redeemedBy: string,
    redeemedAt: date,
    expiresAt: date,
    plan: string
}

export interface ICustomPlaylist extends mongoose.Document {
    userId: string,
    playlist: Array<ICustomPlaylistData>
}

export interface ICustomPlaylistData {
    name: string,
    songs: Array<ICustomPlaylistDataSong>
}

export interface ICustomPlaylistDataSong {
    title: string,
    url: string
}