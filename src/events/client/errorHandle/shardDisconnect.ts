import { Events } from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: Events.ShardDisconnect,
    execute: async (event, shardID, client) => {
        client.logger.error(`Shard ${shardID} disconnected with code ${event.code}, reason: ${event.reason}`);
        setTimeout(() => {
            client.logger.error('Reconnecting...');
            client.login(process.env.TOKEN);
        }, 1000);
    }
};

export default event;