import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { NowPlayingManager } from '../../../../core/music';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.PlayerStateUpdate,
	execute: async (oldPlayer: magmastream.Player | null, newPlayer: magmastream.Player | null, changeType: any, client: discord.Client) => {
		try {
			if (!oldPlayer && !newPlayer) return client.logger.debug('[PLAYER_STATE_UPDATE] Both oldPlayer and newPlayer are null, skipping');

			const player = newPlayer || oldPlayer;
			if (!player || !player.guildId) return client.logger.debug('[PLAYER_STATE_UPDATE] No valid player or guild found, skipping');

			client.logger.debug(`[PLAYER_STATE_UPDATE] Event triggered for guild ${player.guildId}`);

			if (!newPlayer || !newPlayer.playing || newPlayer.paused) return client.logger.debug(`[PLAYER_STATE_UPDATE] Skipping update - player not playing or paused`);
			if (newPlayer && newPlayer.playing && !newPlayer.paused) {
				const now = Date.now();
				const lastUpdate = (newPlayer as any).lastUpdateTime || 0;
				if (now - lastUpdate > 15000 || changeType?.details?.changeType === 'trackChange') {
					(newPlayer as any).lastUpdateTime = now;
					if (changeType?.details?.changeType === 'trackChange') NowPlayingManager.removeInstance(player.guildId);
					const nowPlayingManager = NowPlayingManager.getInstance(player.guildId, newPlayer, client);
					if (nowPlayingManager.hasMessage()) nowPlayingManager.forceUpdate();
				}
			}
		} catch (error) {
			client.logger.error(`[PLAYER_STATE_UPDATE] Error handling state change: ${error}`);
		}
	},
};

export default lavalinkEvent;
