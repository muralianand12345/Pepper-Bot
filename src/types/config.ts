import { BotPresence } from "./events";


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
            cooldown_message: string;
        };
        log: {
            command: string;
            server: string;
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
}