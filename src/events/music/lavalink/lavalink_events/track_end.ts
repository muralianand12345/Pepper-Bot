import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { Autoplay } from '../../../../core/music';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.TrackEnd,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackEndEvent, client: discord.Client) => {
		try {
			if (!player?.guildId) return;

			client.logger.debug(`[LAVALINK] Track ${track.title} ended in guild ${player.guildId} with reason: ${payload.reason}`);

			const finishedNaturally = payload.reason === 'finished';
			const queueIsNearlyEmpty = player.queue.size < 2;
			if (finishedNaturally && queueIsNearlyEmpty) {
				const autoplayManager = Autoplay.getInstance(player.guildId, player, client);
				if (autoplayManager.isEnabled()) await autoplayManager.processTrack(track);
			}
		} catch (error) {
			client.logger.error(`[LAVALINK] Error in trackEnd event: ${error}`);
		}
	},
};

export default lavalinkEvent;
