import { Events } from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: Events.ShardReconnecting,
    execute: async (shardID, client) => {
        client.logger.warn(`Shard ${shardID} is reconnecting...`);
    }
};

export default event;