import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';

import { send } from '../../../../utils/msg';
import { LavalinkEvent } from '../../../../types';
import { LocaleDetector } from '../../../../core/locales';
import { NowPlayingManager, ActivityCheckManager, MusicResponseHandler, VoiceChannelStatus } from '../../../../core/music';
import { v2 } from '../../../../utils/v2';

const localeDetector = new LocaleDetector();

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.PlayerDestroy,
	execute: async (player: magmastream.Player, client: discord.Client) => {
		const guild = client.guilds.cache.get(player.guildId);
		if (!guild) return;

		try {
			const nowPlayingManager = NowPlayingManager.getInstance(player.guildId, player, client);
			nowPlayingManager.onStop();
			if (player.textChannelId) {
				const channel = (await client.channels.fetch(player.textChannelId)) as discord.TextChannel;
				if (channel?.isTextBased()) {
					let guildLocale = 'en';
					try {
						guildLocale = (await localeDetector.getGuildLanguage(player.guildId)) || 'en';
					} catch (error) {}
					const responseHandler = new MusicResponseHandler(client);
					const disconnectContainer = responseHandler.createPlayerStateContainer('disconnected', client.localizationManager?.translate('responses.music.disconnected', guildLocale) || '🔌 Music player disconnected');
					await send(client, channel.id, v2(disconnectContainer));
					await new VoiceChannelStatus(client).clear(player.voiceChannelId || '');
					client.logger.debug(`[PLAYER_DESTROY] Disconnect message sent for guild ${player.guildId}`);
				}
			}
		} catch (messageError) {
			client.logger.warn(`[PLAYER_DESTROY] Failed to send disconnect message: ${messageError}`);
		}

		NowPlayingManager.removeInstance(player.guildId);
		ActivityCheckManager.removeInstance(player.guildId);

		client.logger.info(`[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`);
	},
};

export default lavalinkEvent;
