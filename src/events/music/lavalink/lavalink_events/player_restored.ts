import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { ActivityCheckManager, countListeners, handleEmptyVoiceChannel } from '../../../../core/music';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.PlayerRestored,
	execute: async (player: magmastream.Player, node: magmastream.Node, client: discord.Client) => {
		client.logger.success(`[LAVALINK] Player for guild ${player.guildId} restored on node ${node.options.identifier}.`);
		try {
			if ((await player.queue.getCurrent()) && !ActivityCheckManager.hasInstance(player.guildId)) ActivityCheckManager.getInstance(player.guildId, player, client);
			if (countListeners(client, player.voiceChannelId) === 0) await handleEmptyVoiceChannel(player, client);
		} catch (error) {
			client.logger.error(`[LAVALINK] Failed to re-arm inactivity checks for restored player in guild ${player.guildId}: ${error}`);
		}
	},
};

export default lavalinkEvent;
