import discord from 'discord.js';
import os from 'os';
import { HealthResponseDto, DiscordHealthResponseDto } from '../dto/health-dto';

class HealthService {
    private readonly client: discord.Client;
    private readonly startTime: number;

    constructor(client: discord.Client) {
        this.client = client;
        this.startTime = Date.now();
    }

    public getApiHealth(): HealthResponseDto {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const cpuLoad = os.loadavg()[0];
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = parseFloat(((1 - freeMem / totalMem) * 100).toFixed(2));

        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime,
            system: {
                platform: os.platform(),
                cpuLoad,
                memoryUsage,
                nodeVersion: process.version
            }
        };
    }

    public getDiscordHealth(): DiscordHealthResponseDto | null {
        if (!this.client.user || !this.client.ws.shards.size) {
            return null;
        }

        const shardStatuses = Array.from(this.client.ws.shards.values()).map(shard => ({
            id: shard.id,
            status: shard.status
        }));

        return {
            status: 'connected',
            timestamp: new Date().toISOString(),
            ping: this.client.ws.ping,
            shards: {
                total: this.client.ws.shards.size,
                status: shardStatuses
            }
        };
    }
}

export default HealthService;