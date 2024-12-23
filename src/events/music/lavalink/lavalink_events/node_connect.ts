import discord from "discord.js";
import { Node } from "magmastream";
import { LavalinkEvent } from '../../../../types';

/**
 * Lavalink node connect event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "nodeConnect",
    execute: async (node: Node, client: discord.Client) => {
        client.logger.success(`[LAVALINK] Node ${node.options.identifier} connected`);
    }
};

export default lavalinkEvent;