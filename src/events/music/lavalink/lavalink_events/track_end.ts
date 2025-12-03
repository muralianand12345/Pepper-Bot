import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { VoiceChannelStatus } from '../../../../core/music';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.TrackEnd,
	execute: async (player: magmastream.Player, track: magmastream.Track, payload: magmastream.TrackEndEvent, client: discord.Client) => {
		try {
			if (!player?.guildId) return;
			const voiceStatus = new VoiceChannelStatus(client);
			await voiceStatus.clear(player.voiceChannelId || '');
			client.logger.debug(`[LAVALINK] Track ${track.title} ended in guild ${player.guildId} with reason: ${payload.reason}`);
		} catch (error) {
			client.logger.error(`[LAVALINK] Error in trackEnd event: ${error}`);
		}
	},
};

export default lavalinkEvent;
