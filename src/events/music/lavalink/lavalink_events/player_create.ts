import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.PlayerCreate,
	execute: async (player: magmastream.Player, client: discord.Client) => {
		const guild = client.guilds.cache.get(player.guildId);
		if (!guild) return;
		client.logger.info(`[LAVALINK] Player for guild ${guild.name} (${guild.id}) created using Node ${player.node.options.identifier} (${player.node.options.host}:${player.node.options.port || ''})`);
	},
};

export default lavalinkEvent;
