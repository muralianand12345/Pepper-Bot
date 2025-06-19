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
	data: new discord.SlashCommandBuilder()
		.setName('play')
		.setDescription('Play a song via song name or url')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addStringOption((option) => option.setName('song').setDescription('Song Name/URL').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.song.description')).setRequired(true).setAutocomplete(true))
		.addStringOption((option) => option.setName('lavalink_node').setDescription('Lavalink to play the song (Optional)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.play.options.lavalink_node.description')).setRequired(false).setAutocomplete(true)),
	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		const focused = interaction.options.getFocused(true);
		const t = await localeDetector.getTranslator(interaction);
		const user_language = await localeDetector.getUserLanguage(interaction.user.id);

		try {
			let suggestions;

			if (focused.name === 'lavalink_node') {
				const nodes: INodeOption[] = client.manager.nodes.filter((node: magmastream.Node) => node.connected == true).map((node: magmastream.Node) => ({ name: `${node.options.identifier} (${node.options.host})`, value: node.options.identifier || 'Unknown Node' }));
				suggestions = nodes.filter((option: INodeOption) => option.name.toLowerCase().includes(focused.value.toLowerCase()));
			} else if (focused.name === 'song') {
				if (!focused.value) {
					const defaultText = t('responses.default_search');
					suggestions = [{ name: defaultText.slice(0, 100), value: defaultText }];
				} else {
					focused.value = focused.value.split('?')[0].split('#')[0];
					const isSpotifyLink = focused.value.match(/^(https:\/\/open\.spotify\.com\/|spotify:)/i);
					const isStringWithoutHttp = focused.value.match(/^(?!https?:\/\/)([a-zA-Z0-9\s]+)$/);
					if (isSpotifyLink || isStringWithoutHttp) {
						suggestions = await new SpotifyAutoComplete(client, configManager.getSpotifyClientId(), configManager.getSpotifyClientSecret(), user_language || 'en').getSuggestions(focused.value);
					} else {
						suggestions = [{ name: `${focused.value.slice(0, 80)}`, value: focused.value }];
					}
				}
			}
			await interaction.respond(suggestions || []);
		} catch (error) {
			client.logger.error(`[PLAY_COMMAND] Autocomplete error: ${error}`);
			const errorText = t('responses.errors.no_results');
			await interaction.respond([{ name: errorText.slice(0, 100), value: errorText }]);
		}
	},
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const music = new Music(client, interaction);
		await music.play();
	},
};

export default playCommand;
