import { Events } from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: Events.ShardError,
    execute: async (error, shardID, client) => {
        client.logger.error(`Shard ${shardID} encountered an error: ${error}`);
    }
};

export default event;