import { Events } from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: Events.ShardError,
    execute: async (shardID, unavailableGuilds, client) => {
        client.logger.info(`Shard ${shardID} is ready!`);
    }
};

export default event;