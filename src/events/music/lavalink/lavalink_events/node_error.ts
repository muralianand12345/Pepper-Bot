import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink node error event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.NodeError,
    execute: async (
        node: magmastream.Node,
        error: Error,
        client: discord.Client
    ) => {
        client.logger.error(
            `[LAVALINK] Node ${node.options.identifier} encountered an error]\n${error}`
        );
    },
};

export default lavalinkEvent;
