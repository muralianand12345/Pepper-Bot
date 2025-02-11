import os from "os";
import discord from "discord.js";
import Formatter from "../../utils/format";
import { SlashCommand } from "../../types";

/**
 * Ping command to check bot latency and system status
 * @type {SlashCommand}
 */
const pingCommand: SlashCommand = {
    cooldown: 120,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check bot status and response time"),

    /**
     * Executes the ping command and displays detailed system information
     * @param {discord.ChatInputCommandInteraction} interaction - The command interaction
     * @param {discord.Client} client - The Discord client instance
     */
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        try {
            const startTime = Date.now();
            await interaction.deferReply();

            const endTime = Date.now();
            const roundTripLatency = endTime - startTime;
            const heapUsed = Math.round(
                process.memoryUsage().heapUsed / 1024 / 1024
            );
            const totalMem = Math.round(os.totalmem() / 1024 / 1024);
            const freeMem = Math.round(os.freemem() / 1024 / 1024);
            const usedMem = totalMem - freeMem;
            const uptime = Math.round(process.uptime());

            const embed = new discord.EmbedBuilder()
                .setTitle("🤖 Bot Status")
                .setDescription("> System metrics and performance data")
                .addFields(
                    {
                        name: "📊 Latency",
                        value: [
                            `• **Roundtrip**: \`${roundTripLatency}ms\``,
                            `• **API**: \`${client.ws.ping}ms\``,
                            `• **Uptime**: \`${Formatter.formatUptime(
                                uptime
                            )}\``,
                        ].join("\n"),
                        inline: true,
                    },
                    {
                        name: "💾 Memory",
                        value: [
                            `• **Heap**: \`${heapUsed}MB\``,
                            `• **Used**: \`${usedMem}MB\``,
                            `• **Total**: \`${totalMem}MB\``,
                        ].join("\n"),
                        inline: true,
                    },
                    {
                        name: "🔧 System",
                        value: [
                            `• **Platform**: \`${process.platform}\``,
                            `• **Node**: \`${process.version}\``,
                            `• **CPU**: \`${os.cpus()[0].model}\``,
                        ].join("\n"),
                        inline: true,
                    }
                )
                .setColor("#2B2D31")
                .setFooter({ text: `${client.user?.username} Status Monitor` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error executing ping command:", error);
            await interaction.reply({
                content: "Failed to fetch system status. Please try again.",
                flags: discord.MessageFlags.Ephemeral,
            });
        }
    },
};

export default pingCommand;
