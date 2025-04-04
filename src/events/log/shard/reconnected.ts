import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.ShardReconnecting,
    execute: async (shardID: number, client: discord.Client): Promise<void> => {
        client.logger.warn(`[SHARD] Shard ${shardID} reconnecting...`);
    },
};

export default event;
