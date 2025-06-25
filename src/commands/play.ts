import discord from 'discord.js';
import magmastream from 'magmastream';

import { Command, INodeOption } from '../types';
import { ConfigManager } from '../utils/config';
import { Music, SpotifyAutoComplete } from '../core/music';
import { LocalizationManager, LocaleDetector } from '../core/locales';

const configManager = ConfigManager.getInstance();
const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const playCommand: Command = {
	cooldown: 1,
	category: ['music'],
	data: new discord.SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a song via song name or url')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addStringOption((option) => option.setName('song').setDescription('Song Name/URL').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.description')).setRequired(true).setAutocomplete(true))
		.addStringOption((option) => option.setName('lavalink_node').setDescription('Lavalink to play the song (Optional)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.description')).setRequired(false).setAutocomplete(true)),
	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		let hasResponded = false;

		const safeRespond = async (suggestions: discord.ApplicationCommandOptionChoiceData[]): Promise<void> => {
			if (hasResponded || !interaction.isAutocomplete()) return;
			try {
				await interaction.respond(suggestions);
				hasResponded = true;
			} catch (error) {
				if (!hasResponded) {
					client.logger.warn(`[PLAY_COMMAND] Failed to respond to autocomplete: ${error}`);
				}
			}
		};

		const focused = interaction.options.getFocused(true);
		try {
			if (focused.name === 'lavalink_node') {
				const nodes: INodeOption[] = client.manager.nodes
					.filter((node: magmastream.Node) => node.connected)
					.map((node: magmastream.Node) => ({
						name: `${node.options.identifier} (${node.options.host})`,
						value: node.options.identifier || 'Unknown Node',
					}));

				const filteredNodes = nodes.filter((option: INodeOption) => option.name.toLowerCase().includes(focused.value.toLowerCase()));
				await safeRespond(filteredNodes);
				return;
			}

			if (focused.name === 'song') {
				if (!focused.value?.trim()) {
					const t = await localeDetector.getTranslator(interaction);
					const defaultText = t('responses.default_search');
					await safeRespond([{ name: defaultText.slice(0, 100), value: defaultText }]);
					return;
				}

				const cleanValue = focused.value.split('?')[0].split('#')[0].trim();
				const isSpotifyLink = /^(https:\/\/open\.spotify\.com\/|spotify:)/i.test(cleanValue);
				const isStringWithoutHttp = /^(?!https?:\/\/)([a-zA-Z0-9\s]+)$/.test(cleanValue);

				if (isSpotifyLink || isStringWithoutHttp) {
					const timeoutPromise = new Promise<discord.ApplicationCommandOptionChoiceData[]>((_, reject) => setTimeout(() => reject(new Error('Spotify API timeout')), 2000));
					const user_language = await localeDetector.getUserLanguage(interaction.user.id);
					const spotifyPromise = new SpotifyAutoComplete(client, configManager.getSpotifyClientId(), configManager.getSpotifyClientSecret(), user_language || 'en').getSuggestions(cleanValue);

					try {
						const suggestions = await Promise.race([spotifyPromise, timeoutPromise]);
						await safeRespond(suggestions);
					} catch (spotifyError) {
						client.logger.warn(`[PLAY_COMMAND] Spotify autocomplete error: ${spotifyError}`);
						await safeRespond([{ name: cleanValue.slice(0, 80), value: cleanValue }]);
					}
				} else {
					await safeRespond([{ name: cleanValue.slice(0, 80), value: cleanValue }]);
				}
			}
		} catch (error) {
			client.logger.error(`[PLAY_COMMAND] Autocomplete error: ${error}`);
			if (!hasResponded) {
				try {
					await safeRespond([]);
				} catch (respondError) {
					client.logger.error(`[PLAY_COMMAND] Failed final respond: ${respondError}`);
				}
			}
		}
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.play();
	},
};

export default playCommand;
