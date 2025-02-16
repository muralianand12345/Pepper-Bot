import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink debug event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.Debug,
    execute: async (info: string, client: discord.Client) => {
        client.logger.debug(`[LAVALINK] ${info}`);
    },
};

export default lavalinkEvent;
