import discord from "discord.js";
import magmastream from "magmastream";

import { BotPresence } from "./events";


export interface IConfig {
    bot: {
        owners: Array<string>;
        presence: {
            enabled: boolean;
            status: discord.PresenceStatusData;
            interval: number;
            activity: Array<BotPresence>;
        };
        command: {
            cooldown_message: string;
        };
        log: {
            command: string;
            server: string;
        };
    };
    music: {
        enabled: boolean;
        lavalink: {
            default_search: magmastream.SearchPlatform;
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
}