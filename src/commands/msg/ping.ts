import discord from "discord.js";
import os from "os";
import Formatter from "../../utils/format";
import { Command } from "../../types";

/**
 * Message-based ping command to check bot latency and system status
 */
const command: Command = {
    name: "ping",
    description: "Check bot status and response time",
    cooldown: 120,
    owner: false,

    /**
     * Executes the ping command and displays detailed system information
     * @param {discord.Client} client - The Discord client instance
     * @param {discord.Message} message - The message that triggered the command
     * @param {Array<string>} args - Command arguments
     */
    execute: async (
        client: discord.Client,
        message: discord.Message,
        args: Array<string>
    ): Promise<void> => {
        try {
            const chan = message.channel as
                | discord.GuildTextBasedChannel
                | discord.DMChannel;
            const sent = await chan.send("🏓 Pinging...");

            const roundTripLatency =
                sent.createdTimestamp - message.createdTimestamp;
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

            await sent
                .edit({ content: "", embeds: [embed] })
                .catch(console.error);
        } catch (error) {
            console.error("Error executing ping command:", error);
            await message.reply({
                content: "Failed to fetch system status. Please try again.",
            });
        }
    },
};

export default command;
