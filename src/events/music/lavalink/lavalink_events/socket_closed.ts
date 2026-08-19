import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';

const RECOVERABLE_CLOSE_CODES = [4006, 4009, 4014];

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.SocketClosed,
	execute: async (player: magmastream.Player, payload: magmastream.WebSocketClosedEvent, client: discord.Client) => {
		if (!player?.guildId) return;

		const detail = `code ${payload?.code} (${payload?.reason || 'no reason'}), byRemote: ${payload?.byRemote ?? 'unknown'}`;
		const message = `[LAVALINK] Voice websocket closed for guild ${player.guildId} on node ${player.node.options.identifier}: ${detail}`;

		if (RECOVERABLE_CLOSE_CODES.includes(payload?.code)) return client.logger.warn(`${message} - playback will stay silent until the player reconnects`);
		client.logger.warn(message);
	},
};

export default lavalinkEvent;
