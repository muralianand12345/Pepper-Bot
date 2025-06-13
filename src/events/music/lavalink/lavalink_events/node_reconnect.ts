import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.NodeReconnect,
	execute: async (node: magmastream.Node, client: discord.Client) => client.logger.warn(`[LAVALINK] Node ${node.options.identifier} reconnected`),
};

export default lavalinkEvent;
