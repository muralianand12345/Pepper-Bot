import { Events } from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: Events.Debug,
    execute: async (info, client) => {
        if (!client.config.debug) return;
        client.logger.debug(info);
    }
};

export default event;