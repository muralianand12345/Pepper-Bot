import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord shard error events
 * Triggered when a shard encounters an operational error
 *
 * @event ShardError
 * @implements {BotEvent}
 *
 * Features:
 * - Error monitoring for shards
 * - Detailed error logging
 * - Shard-specific error tracking
 *
 * @param {Error} error - Error object containing error details
 * @param {number} shardID - ID of the shard that encountered the error
 * @param {discord.Client} client - Discord client instance
 *
 * @remarks
 * Common error scenarios:
 * - Network connectivity issues
 * - API errors
 * - Rate limiting
 * - WebSocket errors
 */
const event: BotEvent = {
    name: discord.Events.ShardError,
    execute: async (
        error: Error,
        shardID: number,
        client: discord.Client
    ): Promise<void> => {
        client.logger.error(
            `[SHARD] Shard ${shardID} encountered an error: ${error.message}`
        );
    },
};

export default event;
