import discord from "discord.js";
import { Node } from "magmastream";
import { LavalinkEvent } from '../../../../types';

/**
 * Lavalink node error event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "nodeError",
    execute: async (node: Node, error: Error, client: discord.Client) => {
        client.logger.error(`[LAVALINK] Node ${node.options.identifier} encountered an error]\n${error}`);
    }
};

export default lavalinkEvent;