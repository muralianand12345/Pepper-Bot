import discord from "discord.js";
import Formatter from "../../utils/format";
import { QueuePagination } from "../../utils/music/music_functions";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { SlashCommand } from "../../types";

const queuecommand: SlashCommand = {
    cooldown: 5,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("queue")
        .setDescription("Show the current music queue")
        .setContexts(discord.InteractionContextType.Guild),
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
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
        if (!player)
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "No music is currently playing"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });

        const validator = new VoiceChannelValidator(client, interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid)
                return await interaction.reply({
                    embeds: [embed],
                    flags: discord.MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply();

        const queueList = Array.from(player.queue, (song, index) => ({
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
                        name: Formatter.truncateText(song.title, 50),
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
                player.queue.size > pagination.itemsPerPage
                    ? [paginationRow]
                    : [],
        });

        const collector = replyMessage.createMessageComponentCollector({
            filter: (i: any) =>
                i.customId === "previous-music-queue" ||
                i.customId === "next-music-queue",
            time: 120 * 1000,
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
    },
};

export default queuecommand;
