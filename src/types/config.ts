import discord from 'discord.js';

import { IBotPresence } from './events';


export interface IConfig {
    bot: {
        owners: Array<string>;
        presence: {
            enabled: boolean;
            status: string;
            interval: number;
            activity: Array<IBotPresence>;
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
        features?: {
            spotify_presence?: {
                enabled: boolean;
            };
            dj_role?: {
                enabled: boolean;
                default_timeout: number;
                default_role_name: string;
            };
        };
    };
    music: {
        enabled: boolean;
        dashboard_url: string;
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
            random_tips: Array<string>;
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
        webhook: string | null;
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