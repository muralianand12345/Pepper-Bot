import discord from 'discord.js';

import { BotEvent } from '../../../types';
import { Music, NowPlayingManager, ActivityCheckManager } from '../../../core/music';
import { LocaleDetector } from '../../../core/locales';
import { v2Ephemeral, v2Text } from '../../../utils/v2';

const MUSIC_BUTTON_IDS = ['pause-music', 'resume-music', 'skip-music', 'stop-music', 'loop-music', 'activity-check-continue'];

const localeDetector = new LocaleDetector();

const validateButtonInteraction = (interaction: discord.Interaction): interaction is discord.ButtonInteraction => {
	return interaction.isButton() && MUSIC_BUTTON_IDS.includes(interaction.customId);
};

const handleMusicButtonAction = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
	try {
		if (interaction.customId === 'activity-check-continue') {
			await handleActivityCheckContinue(interaction, client);
			return;
		}

		const music = new Music(client, interaction);
		const nowPlayingManager = interaction.guildId ? NowPlayingManager.getInstance(interaction.guildId, client.manager.getPlayer(interaction.guildId)!, client) : null;

		switch (interaction.customId) {
			case 'pause-music':
				await music.pause();
				if (nowPlayingManager) nowPlayingManager.onPause();
				break;
			case 'resume-music':
				await music.resume();
				if (nowPlayingManager) nowPlayingManager.onResume();
				break;
			case 'skip-music':
				await music.skip();
				break;
			case 'stop-music':
				await music.stop();
				if (nowPlayingManager) nowPlayingManager.onStop();
				break;
			case 'loop-music':
				await music.loop();
				break;
			default:
				client.logger.warn(`[MUSIC_BUTTON] Unknown button interaction: ${interaction.customId}`);
				break;
		}
	} catch (error) {
		client.logger.error(`[MUSIC_BUTTON] Error handling button ${interaction.customId}: ${error}`);

		if (!interaction.replied && !interaction.deferred) {
			try {
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.general_error');
				await interaction.reply(v2Ephemeral(v2Text(`❌ ${message}`))).catch(() => {});
			} catch (localeError) {
				await interaction.reply(v2Ephemeral(v2Text('❌ An error occurred while processing your request.'))).catch(() => {});
			}
		}
	}
};

const handleActivityCheckContinue = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
	const guildId = interaction.guildId;
	if (!guildId) {
		await interaction.reply(v2Ephemeral(v2Text('❌ This button can only be used in a server.')));
		return;
	}

	const player = client.manager.getPlayer(guildId);
	if (!player) {
		await interaction.reply(v2Ephemeral(v2Text('❌ No active music player found.')));
		return;
	}

	if (!ActivityCheckManager.hasInstance(guildId)) {
		await interaction.reply(v2Ephemeral(v2Text('❌ No activity check is pending.')));
		return;
	}

	const activityCheckManager = ActivityCheckManager.getInstance(guildId, player, client);

	if (!activityCheckManager.isPending()) {
		await interaction.reply(v2Ephemeral(v2Text('❌ This activity check has already been handled.')));
		return;
	}

	await interaction.deferUpdate();
	await activityCheckManager.onContinueConfirmed();

	client.logger.info(`[MUSIC_BUTTON] Activity check confirmed by user ${interaction.user.id} in guild ${guildId}`);
};

const event: BotEvent = {
	name: discord.Events.InteractionCreate,
	execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
		if (!validateButtonInteraction(interaction)) return;
		if (!client.config.music.enabled) {
			try {
				const t = await localeDetector.getTranslator(interaction);
				const message = t('responses.errors.music_disabled');
				await interaction.reply(v2Ephemeral(v2Text(`❌ ${message}`))).catch(() => {});
			} catch (localeError) {
				await interaction.reply(v2Ephemeral(v2Text('❌ Music is currently disabled.'))).catch(() => {});
			}
			return;
		}
		await handleMusicButtonAction(interaction, client);
	},
};

export default event;
