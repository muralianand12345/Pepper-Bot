

export interface HealthResponseDto {
    status: string;
    timestamp: string;
    uptime: string;
    version: string;
    discord: {
        status: discord.Status;
        ping: number;
        guilds: number;
        users: number;
    };
}