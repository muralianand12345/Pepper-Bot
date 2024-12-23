import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord shard resume events
 * Triggered when a shard successfully resumes a previous session
 * 
 * @event ShardResume
 * @implements {BotEvent}
 * 
 * Features:
 * - Monitors successful shard resumption
 * - Tracks replayed events
 * - Logs session recovery details
 * 
 * @param {number} shardID - ID of the resumed shard
 * @param {number} replayedEvents - Number of events replayed after resuming
 * @param {discord.Client} client - Discord client instance
 * 
 * @remarks
 * - Replayed events are events that occurred during disconnection
 * - Session resumption is more efficient than full reconnection
 * - High replay counts may indicate connection stability issues
 */
const event: BotEvent = {
    name: discord.Events.ShardResume,
    execute: async (shardID: number, replayedEvents: number, client: discord.Client) => {
        client.logger.info(`[SHARD] Shard ${shardID} resumed. Replayed ${replayedEvents} events.`);
    }
};

export default event;