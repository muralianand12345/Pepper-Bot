import discord from "discord.js";
import magmastream from "magmastream";
import Formatter from "../../utils/format";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { SlashCommand, FilterPreset } from "../../types";

const FILTER_PRESETS: Record<string, FilterPreset> = {
    clear: { name: "Clear", emoji: "🔄", description: "Remove all filters" },
    bassboost: { name: "Bass Boost", emoji: "🔊", description: "Enhance the bass frequencies" },
    nightcore: { name: "Nightcore", emoji: "🎵", description: "Speed up and pitch the audio" },
    vaporwave: { name: "Vaporwave", emoji: "🌊", description: "Slow down and lower the pitch" },
    pop: { name: "Pop", emoji: "🎤", description: "Enhance vocals and mids" },
    soft: { name: "Soft", emoji: "🕊️", description: "Gentle, smooth sound" },
    treblebass: { name: "Treble Bass", emoji: "📊", description: "Enhance both highs and lows" },
    eightd: { name: "8D Audio", emoji: "🎧", description: "Spatial rotating effect" },
    karaoke: { name: "Karaoke", emoji: "🎤", description: "Reduce vocals for karaoke" },
    vibrato: { name: "Vibrato", emoji: "〰️", description: "Add vibrato effect" },
    tremolo: { name: "Tremolo", emoji: "📳", description: "Add tremolo effect" }
};

const isValidFilterName = (filterName: string): filterName is keyof typeof FILTER_PRESETS => {
    return filterName in FILTER_PRESETS;
};

const filterCommand: SlashCommand = {
    cooldown: 5,
    owner: false,
    dj: true,
    data: new discord.SlashCommandBuilder()
        .setName("filter")
        .setDescription("Apply audio filters to the music (DJ only)")
        .setContexts(discord.InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName("preset")
                .setDescription("Audio filter preset to apply")
                .setRequired(true)
                .addChoices(
                    ...Object.entries(FILTER_PRESETS).map(([value, data]) => ({
                        name: `${data.emoji} ${data.name} - ${data.description}`,
                        value
                    }))
                )
        ),

    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
        // Check if music is enabled
        if (!client.config.music.enabled) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Music is currently disabled"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        // Check if DJ role feature is enabled
        if (!client.config.bot.features?.dj_role?.enabled) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "The DJ role feature is not enabled on this server"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        // Get the player instance
        const player = client.manager.get(interaction.guild?.id || "");
        if (!player) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "No music is currently playing"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        // Run validation checks
        const validator = new VoiceChannelValidator(client, interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) {
                return await interaction.reply({
                    embeds: [embed],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        }

        await interaction.deferReply();

        try {
            const filterName = interaction.options.getString("preset", true);

            // Validate the filter name
            if (!isValidFilterName(filterName)) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "Invalid filter preset selected"
                        ),
                    ],
                });
            }

            // Create filters instance if it doesn't exist
            if (!player.filters) {
                player.filters = new magmastream.Filters(player);
            }

            // Apply the selected filter using the appropriate filter method
            let success = false;

            switch (filterName) {
                case "clear":
                    await player.filters.clearFilters();
                    success = true;
                    break;
                case "bassboost":
                    await player.filters.bassBoost(2); // Medium bass boost level
                    success = true;
                    break;
                case "nightcore":
                    await player.filters.nightcore(true);
                    success = true;
                    break;
                case "vaporwave":
                    await player.filters.vaporwave(true);
                    success = true;
                    break;
                case "pop":
                    await player.filters.pop(true);
                    success = true;
                    break;
                case "soft":
                    await player.filters.soft(true);
                    success = true;
                    break;
                case "treblebass":
                    await player.filters.trebleBass(true);
                    success = true;
                    break;
                case "eightd":
                    await player.filters.eightD(true);
                    success = true;
                    break;
                case "karaoke":
                    await player.filters.setKaraoke({
                        level: 1.0,
                        monoLevel: 1.0,
                        filterBand: 220,
                        filterWidth: 100
                    });
                    success = true;
                    break;
                case "vibrato":
                    await player.filters.setVibrato({
                        frequency: 4,
                        depth: 0.75
                    });
                    success = true;
                    break;
                case "tremolo":
                    await player.filters.tremolo(true);
                    success = true;
                    break;
            }

            if (!success) {
                return await interaction.editReply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "Failed to apply filter. The selected filter preset may not be supported."
                        ),
                    ],
                });
            }

            const preset = FILTER_PRESETS[filterName];

            await interaction.editReply({
                embeds: [
                    new discord.EmbedBuilder()
                        .setColor(client.config.content.embed.color.success as discord.ColorResolvable)
                        .setTitle(`${preset.emoji} Filter Applied: ${preset.name}`)
                        .setDescription(preset.description)
                        .addFields({
                            name: "Applied By",
                            value: `<@${interaction.user.id}>`,
                            inline: true
                        }, {
                            name: "Current Track",
                            value: player.queue.current ?
                                Formatter.truncateText(player.queue.current.title || "Unknown", 50) :
                                "Unknown",
                            inline: true
                        })
                        .setFooter({
                            text: `Filter applied successfully • DJ Command`,
                            iconURL: client.user?.displayAvatarURL()
                        })
                        .setTimestamp()
                ],
            });

            client.logger.info(
                `[FILTER] ${interaction.user.tag} applied the ${filterName} filter in ${interaction.guild?.name} (${interaction.guildId})`
            );
        } catch (error) {
            client.logger.error(`[FILTER] Error applying filter: ${error}`);

            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to apply audio filter. Please try again later.",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
            });
        }
    },
};

export default filterCommand;