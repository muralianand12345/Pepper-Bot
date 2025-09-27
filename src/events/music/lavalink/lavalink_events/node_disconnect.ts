import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.NodeDisconnect,
	execute: async (node: magmastream.Node, reason: { code?: number; reason?: string }, client: discord.Client) => client.logger.warn(`[LAVALINK] Node ${node.options.identifier} disconnected\nCode: ${reason.code}\nReason: ${reason.reason}`),
};

export default lavalinkEvent;
