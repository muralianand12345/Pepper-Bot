import discord from "discord.js";
import { Node } from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink node disconnect event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "nodeDisconnect",
    execute: async (
        node: Node,
        reason: string | number,
        client: discord.Client
    ) => {
        client.logger.error(
            `[LAVALINK] Node ${node.options.identifier} disconnected\n${reason}`
        );
    },
};

export default lavalinkEvent;
