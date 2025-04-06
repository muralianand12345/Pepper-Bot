import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.ShardResume,
    execute: async (
        shardID: number,
        replayedEvents: number,
        client: discord.Client
    ): Promise<void> => {
        client.logger.info(
            `[SHARD] Shard ${shardID} resumed. Replayed ${replayedEvents} events.`
        );
    },
};

export default event;
