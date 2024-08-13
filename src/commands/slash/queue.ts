import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionCollector, ButtonInteraction } from "discord.js";
import { msToTime, textLengthOverCut, hyperlink } from "../../utils/format";

import { SlashCommand } from "../../types";

const queuecommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription("Show the queue")
        .setDMPermission(false),

    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music currently playing")],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const queueList = Array.from(player.queue, (song, index) => ({
            title: `${index + 1}. ${song.title}`,
            duration: song.isStream ? "LIVE" : msToTime(song.duration || 0),
            requester: song.requester,
        }));

        const itemsPerPage = 10;
        let currentPage = 0;
        const maxPage = Math.ceil(queueList.length / itemsPerPage);

        const getQueueListForPage = (page: number) => {
            const startIdx = page * itemsPerPage;
            const endIdx = startIdx + itemsPerPage;
            return queueList.slice(startIdx, endIdx);
        };

        const getQueueEmbed = (queueListForPage: Array<any>) => {
            const leftQueue = Math.max(queueList.length - (currentPage + 1) * itemsPerPage, 0);

            return new EmbedBuilder()
                .setColor(client.config.music.embedcolor)
                .setTitle("📋 Current Queue")
                .setDescription(`🎶 ${hyperlink(textLengthOverCut(player.queue.current?.title || "", 50), player.queue.current?.uri || "")}`)
                .setFooter({ text: player.queue.size > itemsPerPage ? `( ${currentPage + 1} / ${maxPage} Pages )\n+${leftQueue} Songs` : " " })
                .addFields(
                    ...queueListForPage.map((song) => ({
                        name: textLengthOverCut(song.title, 50),
                        value: `**\`${song.duration}\`** (${song.requester})`,
                    }))
                );
        };

        const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("previous-music-queue").setLabel("Previous").setStyle(ButtonStyle.Secondary).setEmoji("⏮️"),
            new ButtonBuilder().setCustomId("next-music-queue").setLabel("Next").setStyle(ButtonStyle.Secondary).setEmoji("⏭️")
        );

        const paginationBtnDisable = (row: ActionRowBuilder<ButtonBuilder>) => {
            row.components[0].setDisabled(currentPage === 0);
            row.components[1].setDisabled(currentPage === maxPage - 1);
        };

        paginationBtnDisable(paginationRow);
        const replyMessage = await interaction.editReply({
            embeds: [getQueueEmbed(getQueueListForPage(currentPage))],
            components: player.queue.size > itemsPerPage ? [paginationRow] : [],
        });

        const filter = (i: any) => i.customId === "previous-music-queue" || i.customId === "next-music-queue";
        const collector = replyMessage.createMessageComponentCollector({ filter, time: 120 * 1000 });

        collector.on("collect", async (i) => {
            if (i.customId === "previous-music-queue") {
                currentPage = Math.max(currentPage - 1, 0);
            } else if (i.customId === "next-music-queue") {
                currentPage = Math.min(currentPage + 1, maxPage - 1);
            }

            paginationBtnDisable(paginationRow);
            await i.update({
                embeds: [getQueueEmbed(getQueueListForPage(currentPage))],
                components: [paginationRow],
            });
        });

        collector.on("end", () => {
            paginationRow.components.forEach((c) => c.setDisabled(true));
            replyMessage.edit({
                embeds: [getQueueEmbed(getQueueListForPage(currentPage))],
                components: [paginationRow],
            });
        });
    }
}

export default queuecommand;