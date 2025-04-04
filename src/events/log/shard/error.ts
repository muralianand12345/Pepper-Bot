import discord from "discord.js";
import { BotEvent } from "../../../types";

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
