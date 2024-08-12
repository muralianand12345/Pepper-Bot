import { Events } from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: Events.ShardResume,
    execute: async (id, replayedEvents, client) => {
        client.logger.info(`Shard ${id} has resumed, replayed ${replayedEvents} events.`);
    }
};

export default event;