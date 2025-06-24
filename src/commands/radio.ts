import discord from 'discord.js';
import { Station } from 'radio-browser-api';

import { Command } from '../types';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { MusicResponseHandler, RadioManager, Music } from '../core/music';

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const createSearchResultsEmbed = (stations: any[], query: string, country: string, language: string, t: any, locale: string, client: discord.Client): discord.EmbedBuilder => {
	const embed = new discord.EmbedBuilder()
		.setColor('#FF6B6B')
		.setTitle(`📻 ${t('responses.radio.search_results')}`)
		.setFooter({ text: t('responses.radio.search_footer'), iconURL: client.user?.displayAvatarURL() })
		.setTimestamp();

	let description = `${t('responses.radio.found_stations', { count: stations.length })}`;
	if (query) description += `\n🔍 ${t('responses.radio.query')}: **${query}**`;
	if (country) description += `\n🌍 ${t('responses.radio.country')}: **${country.toUpperCase()}**`;
	if (language) description += `\n🗣️ ${t('responses.radio.language')}: **${language}**`;

	embed.setDescription(description);

	const stationList = stations
		.slice(0, 10)
		.map((station, index) => {
			const flag = station.countryCode ? `:flag_${station.countryCode.toLowerCase()}:` : '🌍';
			const quality = station.bitrate > 0 ? `${station.bitrate}kbps` : station.codec;
			const popularity = station.votes > 100 ? '⭐' : station.votes > 50 ? '🔥' : '📻';

			return `${popularity} **${index + 1}.** ${station.name}\n` + `└ ${flag} ${station.country} • ${quality} • ${station.language.join(', ')}`;
		})
		.join('\n\n');

	embed.addFields([{ name: t('responses.radio.available_stations'), value: stationList.length > 1024 ? stationList.substring(0, 1021) + '...' : stationList, inline: false }]);
	return embed;
};

const createPopularStationsEmbed = (stations: any[], country: string, t: any, locale: string, client: discord.Client): discord.EmbedBuilder => {
	const embed = new discord.EmbedBuilder()
		.setColor('#FFD700')
		.setTitle(`🏆 ${t('responses.radio.popular_title', { country })}`)
		.setDescription(t('responses.radio.popular_description', { count: stations.length, country }))
		.setFooter({ text: t('responses.radio.popular_footer'), iconURL: client.user?.displayAvatarURL() })
		.setTimestamp();

	const stationList = stations
		.map((station, index) => {
			const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
			const quality = station.bitrate > 0 ? `${station.bitrate}kbps` : station.codec;
			const trend = station.clickTrend > 0 ? '📈' : station.clickTrend < 0 ? '📉' : '➡️';
			return `${medal} **${station.name}**\n` + `└ ${quality} • ${station.votes} votes • ${trend} ${station.clickCount} clicks`;
		})
		.join('\n\n');

	embed.addFields([{ name: t('responses.radio.top_stations'), value: stationList.length > 1024 ? stationList.substring(0, 1021) + '...' : stationList, inline: false }]);
	return embed;
};

const createSearchButtons = (stations: any[], locale: string, t: any): discord.ActionRowBuilder<discord.ButtonBuilder>[] => {
	if (stations.length === 0) return [];

	const components: discord.ActionRowBuilder<discord.ButtonBuilder>[] = [];
	const buttonsPerRow = 5;
	const maxButtons = Math.min(stations.length, 10);

	for (let i = 0; i < maxButtons; i += buttonsPerRow) {
		const row = new discord.ActionRowBuilder<discord.ButtonBuilder>();
		const endIndex = Math.min(i + buttonsPerRow, maxButtons);

		for (let j = i; j < endIndex; j++) {
			const station = stations[j];
			const button = new discord.ButtonBuilder()
				.setCustomId(`radio_play_${station.id}`)
				.setLabel(`${j + 1}. ${station.name.slice(0, 20)}`)
				.setStyle(discord.ButtonStyle.Secondary)
				.setEmoji('📻');
			row.addComponents(button);
		}
		components.push(row);
	}
	return components;
};

const radioCommand: Command = {
	cooldown: 5,
	data: new discord.SlashCommandBuilder()
		.setName('radio')
		.setDescription('Listen to radio stations from around the world')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('play')
				.setDescription('Play a radio station')
				.setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.play.name'))
				.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.play.description'))
				.addStringOption((option) => option.setName('station').setDescription('Search for a radio station').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.station.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.station.description')).setRequired(true).setAutocomplete(true))
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('search')
				.setDescription('Search for radio stations')
				.setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.search.name'))
				.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.search.description'))
				.addStringOption((option) => option.setName('query').setDescription('Station name or keyword').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.query.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.query.description')).setRequired(false))
				.addStringOption((option) => option.setName('country').setDescription('Filter by country code (e.g., US, IN, GB)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.country.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.country.description')).setRequired(false))
				.addStringOption((option) => option.setName('language').setDescription('Filter by language').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.language.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.language.description')).setRequired(false))
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('popular')
				.setDescription('Show popular radio stations')
				.setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.popular.name'))
				.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.popular.description'))
				.addStringOption((option) => option.setName('country').setDescription('Filter by country code').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.country.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.options.country.description')).setRequired(false))
		)
		.addSubcommand((subcommand) => subcommand.setName('stop').setDescription('Stop the current radio stream').setNameLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.stop.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.radio.subcommands.stop.description'))),

	autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
		const focused = interaction.options.getFocused(true);
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'play' && focused.name === 'station') {
			try {
				if (!focused.value || focused.value.length < 2) return await interaction.respond([{ name: 'Type at least 2 characters to search...', value: 'search_placeholder' }]);
				const radioManager = RadioManager.getInstance(client);
				const stations = await radioManager.searchStations({ name: focused.value, limit: 25 });
				const choices = stations.slice(0, 25).map((station: Station) => ({ name: `📻 ${station.name} (${station.country}) - ${station.language.join(', ')}`.slice(0, 100), value: station.id }));
				await interaction.respond(choices);
			} catch (error) {
				client.logger.error(`[RADIO] Autocomplete error: ${error}`);
				await interaction.respond([{ name: 'Error searching stations', value: 'error_placeholder' }]);
			}
		}
	},

	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<discord.InteractionResponse<boolean> | discord.Message<boolean> | void> => {
		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);
		const radioManager = RadioManager.getInstance(client);

		const subcommand = interaction.options.getSubcommand();

		switch (subcommand) {
			case 'play': {
				const stationId = interaction.options.getString('station', true);

				if (stationId === 'search_placeholder' || stationId === 'error_placeholder') {
					const embed = responseHandler.createErrorEmbed(t('responses.radio.invalid_selection'), locale);
					return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}

				const station = await radioManager.getStationById(stationId);
				if (!station) {
					const embed = responseHandler.createErrorEmbed(t('responses.radio.station_not_found'), locale);
					return await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
				}

				const music = new Music(client, interaction);
				await music.playRadio(station);
				break;
			}

			case 'search': {
				await interaction.deferReply();

				const query = interaction.options.getString('query') || '';
				const country = interaction.options.getString('country') || '';
				const language = interaction.options.getString('language') || '';

				const stations = await radioManager.searchStations({
					name: query,
					countryCode: country.toUpperCase(),
					language: language.toLowerCase(),
					limit: 15,
				});

				if (stations.length === 0) {
					const embed = responseHandler.createInfoEmbed(t('responses.radio.no_stations_found'), locale);
					return await interaction.editReply({ embeds: [embed] });
				}

				const embed = createSearchResultsEmbed(stations, query, country, language, t, locale, client);
				const components = createSearchButtons(stations, locale, t);

				await interaction.editReply({ embeds: [embed], components });
				break;
			}

			case 'popular': {
				await interaction.deferReply();

				const country = interaction.options.getString('country') || 'IN';
				const stations = await radioManager.getTopStationsByCountry(country.toUpperCase(), 10);

				if (stations.length === 0) {
					const embed = responseHandler.createInfoEmbed(t('responses.radio.no_popular_stations', { country: country.toUpperCase() }), locale);
					return await interaction.editReply({ embeds: [embed] });
				}

				const embed = createPopularStationsEmbed(stations, country.toUpperCase(), t, locale, client);
				const components = createSearchButtons(stations.slice(0, 5), locale, t);

				await interaction.editReply({ embeds: [embed], components });
				break;
			}

			case 'stop': {
				const music = new Music(client, interaction);
				await music.stopRadio();
				break;
			}
		}
	},
};

export default radioCommand;
