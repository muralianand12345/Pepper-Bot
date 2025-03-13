import discord from 'discord.js';
import { BotInfoDto, BotStatsDto } from '../dto/info-dto';

class InfoService {
    private readonly client: discord.Client;

    constructor(client: discord.Client) {
        this.client = client;
    }

    public getBotInfo(): BotInfoDto | null {
        const { user, uptime, guilds } = this.client;

        if (!user) {
            return null;
        }

        // Calculate total users across all guilds
        const totalUsers = guilds.cache.reduce((acc, guild) =>
            acc + (guild.memberCount || 0), 0);

        return {
            name: user.username,
            id: user.id,
            uptime: uptime || 0,
            guilds: guilds.cache.size,
            users: totalUsers,
            version: process.env.npm_package_version || '1.0.0'
        };
    }

    public getBotStats(): BotStatsDto {
        // Memory usage statistics
        const memUsage = process.memoryUsage();

        // Get number of active players
        const activePlayers = this.client.manager?.players?.size || 0;

        // Simple command execution estimation
        // In a production system, you would track this in a database
        const commandsExecuted = 0; // This would need to be tracked elsewhere

        return {
            players: activePlayers,
            guilds: this.client.guilds.cache.size,
            commandsExecuted,
            memoryUsage: {
                rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
            }
        };
    }
}

export default InfoService;