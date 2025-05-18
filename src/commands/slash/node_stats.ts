import discord from "discord.js";
import magmastream from "magmastream";
import Formatter from "../../utils/format";
import { SlashCommand } from "../../types";

const nodestatsCommand: SlashCommand = {
    cooldown: 120,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("node-stats")
        .setDescription("Display Lavalink node statistics in a compact view"),
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        await interaction.deferReply();

        const nodes = client.manager.nodes;
        if (!nodes || nodes.size === 0) {
            return interaction.editReply({
                content: "❌ | No Lavalink nodes are configured or available",
            });
        }

        try {
            const embed = new discord.EmbedBuilder()
                .setColor("#5865F2")
                .setTitle("🎵 Lavalink Nodes Overview")
                .setDescription(`Monitoring ${nodes.size} audio node${nodes.size > 1 ? 's' : ''}`)
                .setTimestamp()
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            const sortedNodes = Array.from(nodes.values()).sort((a, b) => {
                if (a.options.priority && b.options.priority) {
                    return a.options.priority - b.options.priority;
                }
                return (a.options.identifier || "").localeCompare(b.options.identifier || "");
            });

            sortedNodes.forEach((node: magmastream.Node, index) => {
                const nodeStats: magmastream.NodeStats = node.stats;
                const memoryUsagePercent = Math.round((nodeStats.memory.used / nodeStats.memory.allocated) * 100);
                const cpuLoadPercent = Math.round(nodeStats.cpu.systemLoad * 100);
                const isHealthy = node.connected && cpuLoadPercent < 80 && memoryUsagePercent < 80;
                const statusIndicator = isHealthy ? "🟢" : node.connected ? "🟡" : "🔴";
                const usedMemory = Formatter.formatBytes(nodeStats.memory.used);
                const totalMemory = Formatter.formatBytes(nodeStats.memory.allocated);

                embed.addFields({
                    name: `${statusIndicator} Node ${index + 1}: ${node.options.identifier || "Unknown"}`,
                    value: [
                        `\`Host:\` ${node.options.host}${node.options.port ? `:${node.options.port}` : ""}`,
                        `\`Status:\` ${node.connected ? "Connected" : "Disconnected"}`,
                        `\`Players:\` ${nodeStats.players} (${nodeStats.playingPlayers} active)`,
                        `\`CPU:\` ${cpuLoadPercent}% | \`RAM:\` ${usedMemory}/${totalMemory} (${memoryUsagePercent}%)`,
                        `\`Uptime:\` ${Formatter.formatUptime(Math.floor(nodeStats.uptime / 1000))}`
                    ].join("\n"),
                    inline: false,
                });
            });

            const totalPlayers = sortedNodes.reduce((total, node) => total + node.stats.players, 0);
            const activePlayers = sortedNodes.reduce((total, node) => total + node.stats.playingPlayers, 0);
            const healthyNodes = sortedNodes.filter(node => node.connected).length;

            embed.addFields({
                name: "📊 Summary",
                value: [
                    `\`Healthy Nodes:\` ${healthyNodes}/${nodes.size}`,
                    `\`Total Players:\` ${totalPlayers} (${activePlayers} active)`,
                    `\`Default Search:\` ${client.config.music.lavalink.default_search}`
                ].join(" | "),
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            client.logger.error(`[NODE_STATS] Error fetching node statistics: ${error}`);
            await interaction.editReply({
                content: `❌ An error occurred while fetching node statistics: ${error}`,
            });
        }
    },
};

export default nodestatsCommand;