import discord from 'discord.js';
import { BotStatsDto } from '../dto/info-dto';

class InfoService {
    private readonly client: discord.Client;

    constructor(client: discord.Client) {
        this.client = client;
    }

    public getBotStats(): BotStatsDto {
        const { user, uptime, guilds } = this.client;

        // Get number of active players
        const activePlayers = this.client.manager?.players?.size || 0;

        // Calculate total users across all guilds
        const totalUsers = guilds.cache.reduce((acc, guild) =>
            acc + (guild.memberCount || 0), 0);

        return {
            id: user?.id || '',
            name: user?.username || '',
            uptime: uptime || 0,
            players: activePlayers,
            guilds: guilds.cache.size,
            users: totalUsers,
        };
    }
}

export default InfoService;