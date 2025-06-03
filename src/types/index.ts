import discord from "discord.js";
import magmastream from "magmastream";
import CommandLogger from "../utils/command_logger";

import { SlashCommand, Command } from "./events";
import { ILogger } from "./logger";
import { IConfig } from "./config";


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
        cmdLogger: CommandLogger;
        config: IConfig;
        manager: magmastream.Manager;
    }
}

declare module "magmastream" {
    interface Player {
        cleanupScheduledAt?: number;
    }
}

export interface ICommandInfo {
    name: string;
    description: string;
}

export * from "./db";
export * from "./music";
export * from "./logger";
export * from "./config";
export * from "./events";