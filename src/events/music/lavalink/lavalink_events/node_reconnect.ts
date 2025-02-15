import discord from "discord.js";
import magmastream from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink node reconnect event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "nodeReconnect",
    execute: async (node: magmastream.Node, client: discord.Client) => {
        client.logger.warn(
            `[LAVALINK] Node ${node.options.identifier} reconnected`
        );
    },
};

export default lavalinkEvent;
