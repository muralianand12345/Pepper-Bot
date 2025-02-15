import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord shard ready events
 * Triggered when a shard successfully connects and is ready
 *
 * @event ShardReady
 * @implements {BotEvent}
 *
 * Features:
 * - Monitors shard initialization
 * - Tracks unavailable guilds
 * - Logs successful shard startup
 *
 * @param {number} shardID - ID of the ready shard
 * @param {Set<Snowflake>} unavailableGuilds - Set of guild IDs that are unavailable
 * @param {discord.Client} client - Discord client instance
 *
 * @remarks
 * - Unavailable guilds may become available later
 * - Shard ready doesn't guarantee all guilds are available
 * - Should be used for shard-specific initialization
 */
const event: BotEvent = {
    name: discord.Events.ShardReady,
    execute: async (
        shardID: number,
        unavailableGuilds: Set<discord.Snowflake>,
        client: discord.Client
    ) => {
        client.logger.success(`[SHARD] Shard ${shardID} is ready.`);
    },
};

export default event;
