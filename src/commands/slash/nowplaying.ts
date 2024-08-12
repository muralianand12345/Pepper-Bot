import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

import { msToTime, textLengthOverCut, hyperlink, progressBar } from "../../utils/format";

const newplayingcommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription("Whats playing?")
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
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                ephemeral: true,
            });
        }

        const track = player.queue.current;
        await interaction.deferReply();

        const repeatState = player.queueRepeat ? "Queue repeat enabled" : player.trackRepeat ? "Track repeat enabled" : "Not repeating";
        interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("🎶 Now Playing")
                    .setThumbnail(track.artworkUrl || track.thumbnail || track.uri || "")
                    .setDescription(
                        `${player.playing ? "▶️" : "⏸️"} **${hyperlink(textLengthOverCut(track.title, 50), track.uri || "")}**\n\n${progressBar(player)}\n${msToTime(player.position)} / ${msToTime(
                            player.queue.current.duration || 0
                        )}`
                    )
                    .setColor(client.config.music.embedcolor)
                    .addFields(
                        {
                            name: "Track Duration",
                            value: `┕** \`${track.isStream ? "LIVE" : msToTime(track.duration || 0)}\`**`,
                            inline: true,
                        },
                        {
                            name: "Remaining Queue",
                            value: `┕** \`${player.queue.length} songs\`**`,
                            inline: true,
                        },
                        {
                            name: "Volume",
                            value: `┕** \`${player.volume}%\`**`,
                            inline: true,
                        },
                        {
                            name: "Repeat",
                            value: `┕** \`${repeatState}\`**`,
                            inline: true,
                        },
                        {
                            name: "Requester",
                            value: `┕** ${track.requester}**`,
                            inline: true,
                        },
                        {
                            name: "Channel Name",
                            value: `┕** \`${track.author}\`**`,
                            inline: true,
                        }
                    ),
            ],
        });
    }
}

export default newplayingcommand;