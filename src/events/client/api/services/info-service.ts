import discord from 'discord.js';
import { BotStatsDto } from '../dto/info-dto';

class InfoService {
    private readonly client: discord.Client;
    private readonly startTime: number;

    constructor(client: discord.Client) {
        this.client = client;
        this.startTime = Date.now();
    }

    public getBotStats(): BotStatsDto {
        const { user, guilds } = this.client;
        const activePlayers = this.client.manager?.players?.size || 0;
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
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