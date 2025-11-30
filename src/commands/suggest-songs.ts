import discord from 'discord.js';
import { TrackUtils } from 'magmastream';

import Formatter from '../utils/format';
import { LocalizationManager, LocaleDetector } from '../core/locales';
import { MusicResponseHandler, PlaylistSuggestion } from '../core/music';
import { Command, ISongs, CommandCategory, IPlaylistSuggestionResult } from '../types';

const localeDetector = new LocaleDetector();
const localizationManager = LocalizationManager.getInstance();

const suggestSongsCommand: Command = {
	cooldown: 10,
	dj: true,
	category: CommandCategory.MUSIC,
	data: new discord.SlashCommandBuilder()
		.setName('suggest-songs')
		.setDescription('Get smart music recommendations based on your listening history')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.suggest_songs.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.suggest_songs.description'))
		.setContexts(discord.InteractionContextType.Guild)
		.addIntegerOption((option) => option.setName('count').setDescription('Number of recommendations to get (1-20)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.suggest_songs.options.count.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.suggest_songs.options.count.description')).setRequired(false).setMinValue(1).setMaxValue(20)),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void | discord.Message<boolean>> => {
		await interaction.deferReply();

		const t = await localeDetector.getTranslator(interaction);
		const locale = await localeDetector.detectLocale(interaction);
		const responseHandler = new MusicResponseHandler(client);

		const musicCheck = !client.config.music.enabled;
		if (musicCheck) return await interaction.editReply({ embeds: [responseHandler.createErrorEmbed(t('responses.errors.music_disabled'), locale)] });
		if (!interaction.guild) return await interaction.editReply({ embeds: [responseHandler.createErrorEmbed(t('responses.errors.server_only'), locale)] });

		const count = interaction.options.getInteger('count') || 10;

		try {
			const suggestionEngine = new PlaylistSuggestion(client);
			const startTime = Date.now();
			const result = (await suggestionEngine.getSuggestionsFromUserTopSong(interaction.user.id, interaction.guild.id, count)) as IPlaylistSuggestionResult;
			const executionTime = Date.now() - startTime;

			const { seedSong, recommendations } = result;

			if (!seedSong) {
				return await interaction.editReply({
					embeds: [responseHandler.createInfoEmbed(t('responses.suggest_songs.no_history'))],
				});
			}

			if (!recommendations || recommendations.length === 0) {
				return await interaction.editReply({
					embeds: [responseHandler.createInfoEmbed(t('responses.suggest_songs.no_recommendations', { song: seedSong.title || 'Unknown' }))],
				});
			}

			const sourceBreakdown = recommendations.reduce(
				(acc, track) => {
					if (track.uri.includes('spotify.com')) {
						acc.spotify++;
					} else if (track.sourceName === 'YouTube') {
						acc.youtube++;
					} else if (track.sourceName === 'SoundCloud') {
						acc.soundcloud++;
					} else {
						acc.other++;
					}
					return acc;
				},
				{ spotify: 0, youtube: 0, soundcloud: 0, other: 0 }
			);

			const formatRecommendation = (track: ISongs, index: number): string => {
				if (!track || !track.title || !track.author) {
					return `**${index + 1}.** ${t('responses.suggest_songs.unknown_track')}`;
				}

				const title = Formatter.truncateText(track.title, 40);
				const author = Formatter.truncateText(track.author, 20);
				const isSpotify = track.uri && track.uri.includes('spotify.com');
				const icon = isSpotify ? '🟢' : track.sourceName === 'YouTube' ? '🔴' : track.sourceName === 'SoundCloud' ? '🟠' : '🎵';
				const trackUri = track.uri || '#';

				return `${icon} **${index + 1}.** ${Formatter.hyperlink(title, trackUri)} - **${author}**`;
			};

			const embed = new discord.EmbedBuilder()
				.setColor('#1DB954')
				.setTitle(`🎵 ${t('responses.suggest_songs.title')}`)
				.setDescription(
					t('responses.suggest_songs.description', {
						song: Formatter.truncateText(seedSong.title || 'Unknown Title', 40),
						artist: seedSong.author || 'Unknown Artist',
						spotifyCount: sourceBreakdown.spotify,
						totalCount: recommendations.length,
					})
				)
				.setFooter({
					text: t('responses.suggest_songs.footer', { user: interaction.user.tag }),
					iconURL: interaction.user.displayAvatarURL(),
				})
				.setTimestamp();

			if (seedSong.thumbnail || seedSong.artworkUrl) {
				embed.setThumbnail(seedSong.thumbnail || seedSong.artworkUrl || null);
			}

			if (recommendations.length > 0) {
				const firstGroup = recommendations
					.slice(0, 5)
					.map((track, index) => formatRecommendation(track, index))
					.join('\n');
				embed.addFields({
					name: t('responses.suggest_songs.top_recommendations'),
					value: firstGroup || t('responses.suggest_songs.no_valid_recommendations'),
				});

				if (recommendations.length > 5) {
					const secondGroup = recommendations
						.slice(5, 10)
						.map((track, index) => formatRecommendation(track, index + 5))
						.join('\n');
					embed.addFields({
						name: t('responses.suggest_songs.more_recommendations'),
						value: secondGroup || t('responses.suggest_songs.no_additional_recommendations'),
					});
				}

				if (recommendations.length > 10) {
					const thirdGroup = recommendations
						.slice(10, Math.min(15, recommendations.length))
						.map((track, index) => formatRecommendation(track, index + 10))
						.join('\n');
					embed.addFields({
						name: t('responses.suggest_songs.additional_recommendations'),
						value: thirdGroup || t('responses.suggest_songs.no_additional_recommendations'),
					});
				}

				const sourcesText = [sourceBreakdown.spotify > 0 ? `🟢 ${sourceBreakdown.spotify} Spotify` : null, sourceBreakdown.youtube > 0 ? `🔴 ${sourceBreakdown.youtube} YouTube` : null, sourceBreakdown.soundcloud > 0 ? `🟠 ${sourceBreakdown.soundcloud} SoundCloud` : null, sourceBreakdown.other > 0 ? `🎵 ${sourceBreakdown.other} Other` : null].filter(Boolean).join(' • ');

				if (sourcesText) {
					embed.addFields({
						name: '📊 Sources',
						value: sourcesText,
						inline: false,
					});
				}

				embed.addFields({
					name: '⚡ Performance',
					value: `Generated in ${executionTime}ms`,
					inline: true,
				});
			}

			const row = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
				new discord.ButtonBuilder().setCustomId('play-recommendation-first').setLabel(t('responses.suggest_songs.buttons.play_top')).setStyle(discord.ButtonStyle.Success).setEmoji('▶️'),
				new discord.ButtonBuilder().setCustomId('add-recommendation-queue').setLabel(t('responses.suggest_songs.buttons.add_all')).setStyle(discord.ButtonStyle.Primary).setEmoji('📋'),
				new discord.ButtonBuilder().setCustomId('refresh-recommendation').setLabel(t('responses.suggest_songs.buttons.refresh')).setStyle(discord.ButtonStyle.Secondary).setEmoji('🔄')
			);

			const player = client.manager.getPlayer(interaction.guild.id);
			const message = await interaction.editReply({
				embeds: [embed],
				components: player ? [row] : [],
			});

			if (player) {
				const collector = message.createMessageComponentCollector({
					filter: (i) => i.user.id === interaction.user.id,
					time: 120000,
				});

				collector.on('collect', async (i: discord.MessageComponentInteraction): Promise<discord.Message<boolean> | void> => {
					try {
						const buttonT = await localeDetector.getTranslator(i);
						const buttonLocale = await localeDetector.detectLocale(i);

						if (i.customId === 'play-recommendation-first' && recommendations.length > 0) {
							await i.deferUpdate();

							const topPick = recommendations[0];
							if (!topPick || !topPick.uri) {
								return await i.followUp({
									embeds: [responseHandler.createErrorEmbed(buttonT('responses.suggest_songs.errors.invalid_track'), buttonLocale, true)],
									components: [responseHandler.getSupportButton(buttonLocale)],
									flags: discord.MessageFlags.Ephemeral,
								});
							}

							const searchResult = await client.manager.search(topPick.uri, interaction.user);
							if (!TrackUtils.isErrorOrEmptySearchResult(searchResult) && 'tracks' in searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
								await player.queue.enqueueFront(searchResult.tracks[0]);
								player.stop();
								await i.followUp({
									embeds: [
										responseHandler.createSuccessEmbed(
											buttonT('responses.suggest_songs.now_playing', {
												title: topPick.title || 'Unknown Track',
												artist: topPick.author || 'Unknown Artist',
											})
										),
									],
									flags: discord.MessageFlags.Ephemeral,
								});
							}
						} else if (i.customId === 'add-recommendation-queue') {
							await i.deferUpdate();

							let addedCount = 0;
							for (const rec of recommendations) {
								try {
									if (!rec || !rec.uri) continue;
									const searchResult = await client.manager.search(rec.uri, interaction.user);
									if (!TrackUtils.isErrorOrEmptySearchResult(searchResult) && 'tracks' in searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
										await player.queue.add(searchResult.tracks[0]);
										addedCount++;
									}
								} catch (err) {
									client.logger.error(`[SUGGEST_SONGS] Failed to add track to queue: ${err}`);
								}
							}

							if (!player.playing && !player.paused && (await player.queue.size()) > 0) {
								player.play();
							}

							await i.followUp({
								embeds: [responseHandler.createSuccessEmbed(buttonT('responses.suggest_songs.added_tracks', { count: addedCount }))],
								flags: discord.MessageFlags.Ephemeral,
							});
						} else if (i.customId === 'refresh-recommendation') {
							await i.deferUpdate();

							const refreshStartTime = Date.now();
							const newResult = (await suggestionEngine.getSuggestionsFromUserTopSong(interaction.user.id, interaction.guild?.id || '', count)) as IPlaylistSuggestionResult;
							const refreshExecutionTime = Date.now() - refreshStartTime;

							const { seedSong: newSeedSong, recommendations: newRecommendations } = newResult;

							if (!newSeedSong || !newRecommendations || newRecommendations.length === 0) {
								return await i.followUp({
									embeds: [responseHandler.createInfoEmbed(buttonT('responses.suggest_songs.no_new_recommendations'))],
									flags: discord.MessageFlags.Ephemeral,
								});
							}

							const newSourceBreakdown = newRecommendations.reduce(
								(acc, track) => {
									if (track.uri.includes('spotify.com')) {
										acc.spotify++;
									} else if (track.sourceName === 'YouTube') {
										acc.youtube++;
									} else if (track.sourceName === 'SoundCloud') {
										acc.soundcloud++;
									} else {
										acc.other++;
									}
									return acc;
								},
								{ spotify: 0, youtube: 0, soundcloud: 0, other: 0 }
							);

							const updatedEmbed = new discord.EmbedBuilder()
								.setColor('#1DB954')
								.setTitle(`🎵 ${buttonT('responses.suggest_songs.fresh_title')}`)
								.setDescription(
									buttonT('responses.suggest_songs.description', {
										song: Formatter.truncateText(newSeedSong.title || 'Unknown Title', 40),
										artist: newSeedSong.author || 'Unknown Artist',
										spotifyCount: newSourceBreakdown.spotify,
										totalCount: newRecommendations.length,
									})
								)
								.setFooter({
									text: buttonT('responses.suggest_songs.refreshed_footer', { user: interaction.user.tag }),
									iconURL: interaction.user.displayAvatarURL(),
								})
								.setTimestamp();

							if (newSeedSong.thumbnail || newSeedSong.artworkUrl) {
								updatedEmbed.setThumbnail(newSeedSong.thumbnail || newSeedSong.artworkUrl || null);
							}

							if (newRecommendations.length > 0) {
								const firstGroup = newRecommendations
									.slice(0, 5)
									.map((track, index) => formatRecommendation(track, index))
									.join('\n');
								updatedEmbed.addFields({
									name: buttonT('responses.suggest_songs.top_recommendations'),
									value: firstGroup || buttonT('responses.suggest_songs.no_valid_recommendations'),
								});

								if (newRecommendations.length > 5) {
									const secondGroup = newRecommendations
										.slice(5, 10)
										.map((track, index) => formatRecommendation(track, index + 5))
										.join('\n');
									updatedEmbed.addFields({
										name: buttonT('responses.suggest_songs.more_recommendations'),
										value: secondGroup || buttonT('responses.suggest_songs.no_additional_recommendations'),
									});
								}

								if (newRecommendations.length > 10) {
									const thirdGroup = newRecommendations
										.slice(10, Math.min(15, newRecommendations.length))
										.map((track, index) => formatRecommendation(track, index + 10))
										.join('\n');
									updatedEmbed.addFields({
										name: buttonT('responses.suggest_songs.additional_recommendations'),
										value: thirdGroup || buttonT('responses.suggest_songs.no_additional_recommendations'),
									});
								}

								const newSourcesText = [newSourceBreakdown.spotify > 0 ? `🟢 ${newSourceBreakdown.spotify} Spotify` : null, newSourceBreakdown.youtube > 0 ? `🔴 ${newSourceBreakdown.youtube} YouTube` : null, newSourceBreakdown.soundcloud > 0 ? `🟠 ${newSourceBreakdown.soundcloud} SoundCloud` : null, newSourceBreakdown.other > 0 ? `🎵 ${newSourceBreakdown.other} Other` : null].filter(Boolean).join(' • ');

								if (newSourcesText) {
									updatedEmbed.addFields({
										name: '📊 Sources',
										value: newSourcesText,
										inline: false,
									});
								}

								updatedEmbed.addFields({
									name: '⚡ Performance',
									value: `Refreshed in ${refreshExecutionTime}ms`,
									inline: true,
								});
							}

							const newRow = new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
								new discord.ButtonBuilder().setCustomId('play-recommendation-first').setLabel(buttonT('responses.suggest_songs.buttons.play_top')).setStyle(discord.ButtonStyle.Success).setEmoji('▶️'),
								new discord.ButtonBuilder().setCustomId('add-recommendation-queue').setLabel(buttonT('responses.suggest_songs.buttons.add_all')).setStyle(discord.ButtonStyle.Primary).setEmoji('📋'),
								new discord.ButtonBuilder().setCustomId('refresh-recommendation').setLabel(buttonT('responses.suggest_songs.buttons.refresh')).setStyle(discord.ButtonStyle.Secondary).setEmoji('🔄')
							);

							await interaction.editReply({ embeds: [updatedEmbed], components: [newRow] });
						}
					} catch (error) {
						client.logger.error(`[SUGGEST_SONGS] Button interaction error: ${error}`);
						if (!i.replied && !i.deferred) {
							await i.reply({
								embeds: [responseHandler.createErrorEmbed(t('responses.errors.general_error'), locale, true)],
								components: [responseHandler.getSupportButton(locale)],
								flags: discord.MessageFlags.Ephemeral,
							});
						}
					}
				});

				collector.on('end', async () => {
					row.components.forEach((button) => button.setDisabled(true));
					await interaction.editReply({ components: [row] }).catch(() => {});
				});
			}
		} catch (error) {
			client.logger.error(`[SUGGEST_SONGS] Error: ${error}`);
			await interaction.editReply({
				embeds: [responseHandler.createErrorEmbed(t('responses.suggest_songs.errors.generation_failed'), locale, true)],
				components: [responseHandler.getSupportButton(locale)],
			});
		}
	},
};

export default suggestSongsCommand;
