import discord from "discord.js";
import { BotEvent } from "../../../types";

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
