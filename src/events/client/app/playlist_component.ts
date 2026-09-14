import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { LocaleDetector } from '../../../core/locales';
import { v2Ephemeral, v2Text } from '../../../utils/v2';
import { isPlaylistComponent, PlaylistComponentHandler } from '../../../core/music';

const localeDetector = new LocaleDetector();

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		if (!isPlaylistComponent(interaction)) return;

		try {
			await new PlaylistComponentHandler(client, interaction).handle();
		} catch (error) {
			client.logger.error(`[PLAYLIST_COMPONENT] Error handling ${interaction.customId}: ${error}`);

			const t = await localeDetector.getTranslator(interaction).catch(() => null);
			const reply = v2Ephemeral(v2Text(`❌ ${t ? t('responses.errors.general_error') : 'An error occurred while processing your request.'}`));
			if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(() => {});
			else await interaction.reply(reply).catch(() => {});
		}
	},
};

export default event;
