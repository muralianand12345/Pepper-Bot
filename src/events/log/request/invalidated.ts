import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.Invalidated,
    execute: async (client: discord.Client): Promise<void> => {
        client.logger.warn(`[REQUEST] Client invalidated. Reconnecting...`);
    },
};

export default event;
