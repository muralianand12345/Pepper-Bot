import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.PlayerRestored,
	execute: async (player: magmastream.Player, node: magmastream.Node, client: discord.Client) => client.logger.success(`[LAVALINK] Player for guild ${player.guildId} restored on node ${node.options.identifier}.`),
};

export default lavalinkEvent;
