import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { LavalinkEvent } from "../../../../types";

const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.NodeDisconnect,
    execute: async (
        node: magmastream.Node,
        reason: string,
        client: discord.Client
    ) => {
        client.logger.error(
            `[LAVALINK] Node ${node.options.identifier} disconnected\n${reason}`
        );
    },
};

export default lavalinkEvent;
