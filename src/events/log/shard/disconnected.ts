import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.ShardDisconnect,
    execute: async (
        closeEvent: discord.CloseEvent,
        shardID: number,
        client: discord.Client
    ): Promise<void> => {
        client.logger.warn(
            `[SHARD] Shard ${shardID} disconnected. Code: ${closeEvent.code}.`
        );
    },
};

export default event;
