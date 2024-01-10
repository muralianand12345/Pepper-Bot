const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

const { msToTime, textLengthOverCut, hyperlink, progressBar } = require('../../events/client/commands/functions/format.js');

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription("Whats playing?")
        .setDMPermission(false),
    async execute(interaction, client) {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

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
                    .setThumbnail(track.artworkUrl)
                    .setDescription(
                        `${player.playing ? "▶️" : "⏸️"} **${hyperlink(textLengthOverCut(track.title, 50), track.uri)}**\n\n${progressBar(player)}\n${msToTime(player.position)} / ${msToTime(
                            player.queue.current.duration
                        )}`
                    )
                    .setColor(client.config.music.embedcolor)
                    .addFields(
                        {
                            name: "Track Duration",
                            value: `┕** \`${track.isStream ? "LIVE" : msToTime(track.duration)}\`**`,
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