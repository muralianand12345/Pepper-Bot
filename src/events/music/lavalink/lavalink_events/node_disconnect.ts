import discord from "discord.js";
import magmastream from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink node disconnect event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "nodeDisconnect",
    execute: async (
        node: magmastream.Node,
        reason: string | number,
        client: discord.Client
    ) => {
        client.logger.error(
            `[LAVALINK] Node ${node.options.identifier} disconnected\n${reason}`
        );
    },
};

export default lavalinkEvent;
