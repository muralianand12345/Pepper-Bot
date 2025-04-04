import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.MessageCreate,
    execute: async (
        message: discord.Message,
        client: discord.Client
    ): Promise<void> => {
    }
}

export default event;