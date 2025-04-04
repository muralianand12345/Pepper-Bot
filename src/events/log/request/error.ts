import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.Error,
    execute: async (error: Error, client: discord.Client): Promise<void> => {
        client.logger.error(
            `[REQUEST] An error occurred: ${error.message}\n` + error
        );
    },
};

export default event;
