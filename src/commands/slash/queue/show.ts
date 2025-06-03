import discord from "discord.js";
import Formatter from "../../../utils/format";
import { QueuePagination } from "../../../utils/music/music_functions";


export const handleShowQueue = async (
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
                        ? `( ${pagination.getCurrentPage() + 1
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
};