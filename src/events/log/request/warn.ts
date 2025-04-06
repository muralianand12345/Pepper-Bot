import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.Warn,
    execute: async (message: string, client: discord.Client): Promise<void> => {
        client.logger.warn(`[REQUEST] Warning! ${message}`);
    },
};

export default event;
