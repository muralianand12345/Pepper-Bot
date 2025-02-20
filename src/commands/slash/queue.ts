import discord from "discord.js";
import Formatter from "../../utils/format";
import { QueuePagination } from "../../utils/music/music_functions";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { SlashCommand } from "../../types";

/**
 * Displays the current music queue with pagination support
 * @param {discord.ChatInputCommandInteraction} interaction - The interaction that triggered the command
 * @param {discord.Client} client - The Discord client instance
 * @param {any} player - The music player instance
 * @returns {Promise<void>}
 */
const handleShowQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    await interaction.deferReply();

    const queueList = Array.from(player.queue, (song: any, index: number) => ({
        title: `${index + 1}. ${song.title}`,
        duration: song.isStream
            ? "LIVE"
            : Formatter.msToTime(song.duration || 0),
        requester: song.requester,
    }));

    const pagination = new QueuePagination(queueList);

    const createQueueEmbed = () => {
        const currentPageItems = pagination.getCurrentPageItems();
        return new discord.EmbedBuilder()
            .setColor(client.config.content.embed.color.info)
            .setTitle("📋 Current Queue")
            .setDescription(
                `🎶 ${Formatter.hyperlink(
                    Formatter.truncateText(
                        player.queue.current?.title || "",
                        50
                    ),
                    player.queue.current?.uri || ""
                )}`
            )
            .setFooter({
                text:
                    pagination.getMaxPages() > 1
                        ? `( ${
                              pagination.getCurrentPage() + 1
                          } / ${pagination.getMaxPages()} Pages )\n+${pagination.getRemainingItems()} Songs`
                        : " ",
            })
            .addFields(
                ...currentPageItems.map((song) => ({
                    name: `${Formatter.truncateText(song.title, 50)} - ${song.author}`,
                    value: `**\`${song.duration}\`** (${song.requester})`,
                }))
            );
    };

    const paginationRow =
        new discord.ActionRowBuilder<discord.ButtonBuilder>().addComponents(
            new discord.ButtonBuilder()
                .setCustomId("previous-music-queue")
                .setLabel("Previous")
                .setStyle(discord.ButtonStyle.Secondary)
                .setEmoji("⏮️"),
            new discord.ButtonBuilder()
                .setCustomId("next-music-queue")
                .setLabel("Next")
                .setStyle(discord.ButtonStyle.Secondary)
                .setEmoji("⏭️")
        );

    const updatePaginationButtons = () => {
        paginationRow.components[0].setDisabled(
            pagination.getCurrentPage() === 0
        );
        paginationRow.components[1].setDisabled(
            pagination.getCurrentPage() === pagination.getMaxPages() - 1
        );
    };

    updatePaginationButtons();
    const replyMessage = await interaction.editReply({
        embeds: [createQueueEmbed()],
        components:
            player.queue.size > pagination.itemsPerPage ? [paginationRow] : [],
    });

    // Set up the collector for button interactions
    const collector = replyMessage.createMessageComponentCollector({
        filter: (i: any) =>
            i.customId === "previous-music-queue" ||
            i.customId === "next-music-queue",
        time: 120 * 1000, // 2 minutes
    });

    collector.on("collect", async (i) => {
        const moved =
            i.customId === "previous-music-queue"
                ? pagination.previousPage()
                : pagination.nextPage();

        if (moved) {
            updatePaginationButtons();
            await i.update({
                embeds: [createQueueEmbed()],
                components: [paginationRow],
            });
        }
    });

    collector.on("end", () => {
        paginationRow.components.forEach((c) => c.setDisabled(true));
        replyMessage.edit({
            embeds: [createQueueEmbed()],
            components: [paginationRow],
        });
    });
};

/**
 * Removes a song from the specified position in the queue
 * @param {discord.ChatInputCommandInteraction} interaction - The interaction that triggered the command
 * @param {discord.Client} client - The Discord client instance
 * @param {any} player - The music player instance
 * @returns {Promise<void>}
 */
const handleRemoveFromQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    const position = interaction.options.getInteger("position", true) - 1;

    if (position >= player.queue.size) {
        return await interaction.reply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "Invalid position in queue"
                ),
            ],
            flags: discord.MessageFlags.Ephemeral,
        });
    }

    const removedTrack = player.queue[position];
    player.queue.remove(position);

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                `Removed \`${removedTrack.title}\` from the queue`
            ),
        ],
    });
};

/**
 * Moves a song from one position to another in the queue
 * @param {discord.ChatInputCommandInteraction} interaction - The interaction that triggered the command
 * @param {discord.Client} client - The Discord client instance
 * @param {any} player - The music player instance
 * @returns {Promise<void>}
 */
const handleMoveInQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    const from = interaction.options.getInteger("from", true) - 1;
    const to = interaction.options.getInteger("to", true) - 1;

    if (from >= player.queue.size || to >= player.queue.size) {
        return await interaction.reply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "Invalid position in queue"
                ),
            ],
            flags: discord.MessageFlags.Ephemeral,
        });
    }

    const track = player.queue[from];
    player.queue.remove(from);
    player.queue.add(track, to);

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                `Moved \`${track.title}\` to position ${to + 1}`
            ),
        ],
    });
};

/**
 * Clears all songs from the queue
 * @param {discord.ChatInputCommandInteraction} interaction - The interaction that triggered the command
 * @param {discord.Client} client - The Discord client instance
 * @param {any} player - The music player instance
 * @returns {Promise<void>}
 */
const handleClearQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    player.queue.clear();

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                "Cleared the music queue"
            ),
        ],
    });
};

/**
 * Randomly shuffles the current queue
 * @param {discord.ChatInputCommandInteraction} interaction - The interaction that triggered the command
 * @param {discord.Client} client - The Discord client instance
 * @param {any} player - The music player instance
 * @returns {Promise<void>}
 */
const handleShuffleQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    player.queue.shuffle();

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                "Shuffled the music queue"
            ),
        ],
    });
};

/**
 * Queue command handler with subcommands for managing the music queue
 * Supports showing, removing, moving, clearing, and shuffling queue items
 */
const queuecommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("queue")
        .setDescription("Manage the music queue")
        .setContexts(discord.InteractionContextType.Guild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("show")
                .setDescription("Show the current music queue")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Remove a song from the queue")
                .addIntegerOption((option) =>
                    option
                        .setName("position")
                        .setDescription("Position of the song to remove")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("move")
                .setDescription("Move a song to a different position")
                .addIntegerOption((option) =>
                    option
                        .setName("from")
                        .setDescription("Current position of the song")
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("to")
                        .setDescription("New position for the song")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("clear")
                .setDescription("Clear all songs from the queue")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("shuffle")
                .setDescription("Shuffle the current queue")
        ),

    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        // Validation checks...
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

        // Voice channel validation
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

        // Execute the appropriate subcommand
        const subcommand = interaction.options.getSubcommand();
        const handlers = {
            show: handleShowQueue,
            remove: handleRemoveFromQueue,
            move: handleMoveInQueue,
            clear: handleClearQueue,
            shuffle: handleShuffleQueue,
        };

        await handlers[subcommand as keyof typeof handlers](
            interaction,
            client,
            player
        );
    },
};

export default queuecommand;
