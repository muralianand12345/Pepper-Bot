import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.RestoreComplete,
	execute: async (node: magmastream.Node, client: discord.Client) => client.logger.success(`[LAVALINK] Restore complete on node ${node.options.identifier}.`),
};

export default lavalinkEvent;
