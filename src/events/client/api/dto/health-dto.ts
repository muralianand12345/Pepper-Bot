import discord from 'discord.js';
export interface HealthResponseDto {
    status: string;
    timestamp: string;
    uptime: number;
    system: {
        platform: string;
        cpuLoad: number;
        memoryUsage: number;
        nodeVersion: string;
    };
}

export interface DiscordHealthResponseDto {
    status: string;
    timestamp: string;
    ping: number;
    shards: {
        total: number;
        status: Array<{
            id: number;
            status: discord.Status;
        }>;
    };
}