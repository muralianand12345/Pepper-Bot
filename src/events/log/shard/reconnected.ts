import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord shard reconnection attempts
 * Triggered when a shard attempts to reconnect to Discord
 * 
 * @event ShardReconnecting
 * @implements {BotEvent}
 * 
 * Features:
 * - Monitors reconnection attempts
 * - Tracks shard recovery process
 * - Provides reconnection status updates
 * 
 * @param {number} shardID - ID of the reconnecting shard
 * @param {discord.Client} client - Discord client instance
 * 
 * @remarks
 * Common reconnection scenarios:
 * - Network interruption recovery
 * - Session timeout recovery
 * - Rate limit recovery
 * - API outage recovery
 */
const event: BotEvent = {
    name: discord.Events.ShardReconnecting,
    execute: async (shardID: number, client: discord.Client): Promise<void> => {
        client.logger.warn(`[SHARD] Shard ${shardID} reconnecting...`);
    }
};

export default event;