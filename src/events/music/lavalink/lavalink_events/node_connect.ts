import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { LavalinkEvent } from "../../../../types";

const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.NodeConnect,
    execute: async (node: magmastream.Node, client: discord.Client) => {
        client.logger.success(
            `[LAVALINK] Node ${node.options.identifier} connected`
        );
    },
};

export default lavalinkEvent;
