import discord from 'discord.js';
import magmastream, { ManagerEventTypes, StateTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';
import { VoiceChannelStatus } from '../../../../core/music';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.PlayerDisconnect,
	execute: async (player: magmastream.Player, oldChannelId: string | null, client: discord.Client) => {
		if (player.state !== StateTypes.Connected) return;
		client.logger.info(`[PLAYER_DISCONNECT] Bot was disconnected from voice channel ${oldChannelId} in guild ${player.guildId}, destroying player`);
		await player.destroy();
		if (oldChannelId) await new VoiceChannelStatus(client).clear(oldChannelId);
	},
};

export default lavalinkEvent;
