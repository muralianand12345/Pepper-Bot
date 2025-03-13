export interface BotInfoDto {
    name: string;
    id: string;
    uptime: number;
    guilds: number;
    users: number;
    version: string;
}

export interface BotStatsDto {
    players: number;
    guilds: number;
    commandsExecuted: number;
    memoryUsage: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
    };
}