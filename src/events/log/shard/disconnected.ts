import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord shard disconnection events
 * Triggered when a shard loses connection to Discord
 * 
 * @event ShardDisconnect
 * @implements {BotEvent}
 * 
 * Features:
 * - Monitors shard disconnections
 * - Logs disconnection details
 * - Tracks close event codes
 * 
 * @param {discord.CloseEvent} closeEvent - WebSocket close event details
 * @param {number} shardID - ID of the disconnected shard
 * @param {discord.Client} client - Discord client instance
 * 
 * @remarks
 * Common close event codes:
 * - 1000: Normal closure
 * - 1001: Going away
 * - 1006: Abnormal closure
 * - 4000: Unknown error
 * - 4004: Authentication failed
 */
const event: BotEvent = {
    name: discord.Events.ShardDisconnect,
    execute: async (closeEvent: discord.CloseEvent, shardID: number, client: discord.Client): Promise<void> => {
        client.logger.warn(`[SHARD] Shard ${shardID} disconnected. Code: ${closeEvent.code}.`);
    }
};

export default event;