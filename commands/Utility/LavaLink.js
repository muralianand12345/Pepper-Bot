const { EmbedBuilder } = require('discord.js');
const moment = require("moment");
require("moment-duration-format");
const prettyBytes = require("pretty-bytes");

module.exports = {
    name: ["utility", "lavalink"], // The name of the command
    description: "Display the Lavalink stats", // The description of the command (for help text)
    category: "Utility",
    permissions: {
        channel: [],
        bot: [],
        user: []
    },
    settings: {
        isPremium: false,
        isPlayer: false,
        isOwner: true,
        inVoice: false,
        sameVoice: false,
    },
    run: async (interaction, client, user, language) => {
        await interaction.deferReply({ ephemeral: false });
        // owner only
        if (interaction.user.id != client.owner) return interaction.editReply({ content: `${client.i18n.get(language, "interaction", "owner_only")}` });

        const embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({ name: `LavaLink`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 2048 }))
            .setTimestamp()

        client.manager.nodes.forEach((node) => {
            try {
                embed.addFields({
                    name: "Node Info",
                    value: `Name: ${node.options.identifier}\n` +
                        `Connected: ${node.connected ? "Connected [🟢]" : "Disconnected [🔴]"}\n` +
                        `Player: ${node.stats.players}\n` +
                        `Used Players: ${node.stats.playingPlayers}\n` +
                        `Uptime: ${moment.duration(node.stats.uptime).format("d [days], h [hours], m [minutes], s [seconds]")}\n` +
                        `Cores: ${node.stats.cpu.cores} Core(s)\n` +
                        `Memory Usage: ${prettyBytes(node.stats.memory.used)}/${prettyBytes(node.stats.memory.reservable)}\n` +
                        `System Load: ${(Math.round(node.stats.cpu.systemLoad * 100) / 100).toFixed(2)}%\n` +
                        `Lavalink Load: ${(Math.round(node.stats.cpu.lavalinkLoad * 100) / 100).toFixed(2)}%`
                });
            } catch (e) {
                console.log(e);
            }
        });

        return interaction.editReply({ embeds: [embed] });
    }
}