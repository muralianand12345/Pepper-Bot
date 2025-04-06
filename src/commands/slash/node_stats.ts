import discord from "discord.js";
import magmastream from "magmastream";
import { SlashCommand } from "../../types";
import Formatter from "../../utils/format";

const nodestatsCommand: SlashCommand = {
    cooldown: 120,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("node-stats")
        .setDescription("Display Lavalink node statistics"),
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        await interaction.deferReply();

        const nodes = client.manager.nodes;
        if (!nodes) {
            return interaction.editReply({
                content: "❌ | Lavalink manager is not initialized",
            });
        }

        const embeds: discord.EmbedBuilder[] = [];

        nodes.forEach((node: magmastream.Node) => {
            const nodeStats: magmastream.NodeStats = node.stats;
            const memoryUsagePercent =
                (nodeStats.memory.used / nodeStats.memory.allocated) * 100;
            const cpuLoadPercent = nodeStats.cpu.systemLoad * 100;

            // Create progress bars
            const createProgressBar = (percent: number): string => {
                const filledBars = Math.round(percent / 10);
                return "▰".repeat(filledBars) + "▱".repeat(10 - filledBars);
            };

            const embed = new discord.EmbedBuilder()
                .setColor("#FF0000")
                .setTitle(
                    `📊 Node Statistics: ${
                        node.options.identifier || "Unknown Node"
                    }`
                )
                .setDescription(
                    `Current status: ${
                        node.connected ? "🟢 Connected" : "🔴 Disconnected"
                    }`
                )
                .addFields([
                    {
                        name: "🎵 Players",
                        value: `Total: ${nodeStats.players}\nPlaying: ${nodeStats.playingPlayers}`,
                        inline: true,
                    },
                    {
                        name: "⏰ Uptime",
                        value: Formatter.msToTime(nodeStats.uptime),
                        inline: true,
                    },
                    {
                        name: "\u200b",
                        value: "\u200b",
                        inline: true,
                    },
                    {
                        name: "💾 Memory Usage",
                        value:
                            `${createProgressBar(
                                memoryUsagePercent
                            )} ${memoryUsagePercent.toFixed(1)}%\n` +
                            `Used: ${Formatter.formatBytes(
                                nodeStats.memory.used
                            )}\n` +
                            `Allocated: ${Formatter.formatBytes(
                                nodeStats.memory.allocated
                            )}\n` +
                            `Free: ${Formatter.formatBytes(
                                nodeStats.memory.free
                            )}\n` +
                            `Reservable: ${Formatter.formatBytes(
                                nodeStats.memory.reservable
                            )}`,
                        inline: false,
                    },
                    {
                        name: "💻 CPU",
                        value:
                            `${createProgressBar(
                                cpuLoadPercent
                            )} ${cpuLoadPercent.toFixed(1)}%\n` +
                            `Cores: ${nodeStats.cpu.cores}\n` +
                            `Lavalink Load: ${(
                                nodeStats.cpu.lavalinkLoad * 100
                            ).toFixed(1)}%\n` +
                            `System Load: ${(
                                nodeStats.cpu.systemLoad * 100
                            ).toFixed(1)}%`,
                        inline: false,
                    },
                    {
                        name: "📊 Frame Statistics",
                        value:
                            `Sent: ${nodeStats.frameStats?.sent || 0}\n` +
                            `Nulled: ${nodeStats.frameStats?.nulled || 0}\n` +
                            `Deficit: ${nodeStats.frameStats?.deficit || 0}`,
                        inline: false,
                    },
                ])
                .setTimestamp()
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            embeds.push(embed);
        });

        await interaction.editReply({ embeds });
    },
};

export default nodestatsCommand;
