import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import os from "os";

import { SlashCommand } from "../../types";

const statuscommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription("Check Bot Status")
        .setDMPermission(true),
    execute: async (interaction, client) => {

        await interaction.deferReply();

        const botVersion = require("../../../package.json").version;

        var embed = new EmbedBuilder()
            .setColor('Purple')
            .setTitle(`${client.user?.username} Status`)
            .setAuthor({ name: `${client.user?.tag}`, iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();

        const totalSeconds = os.uptime();
        const realTotalSecs = Math.floor(totalSeconds % 60);
        const days = Math.floor((totalSeconds % (31536 * 100)) / 86400);
        const hours = Math.floor((totalSeconds / 3600) % 24);
        const mins = Math.floor((totalSeconds / 60) % 60);

        embed.addFields({
            name: 'Bot Stats:',
            value: `**Name:** \`${client.user?.tag}\`\n` +
                `**ID:** \`${client.user?.id}\`\n` +
                `**Bot Version:** \`${botVersion}\`\n` +
                `**Uptime:** \`${days} days, ${hours} hours, ${mins} minutes, and ${realTotalSecs} seconds\`\n` +
                `**Host:** \`${os.type()} ${os.release()} (${os.arch()})\`\n` +
                `**CPU:** \`${os.cpus()[0].model}\` | **Load:** \`${(os.loadavg()[0]).toFixed(2)}%\` | **Cores:** \`${os.cpus().length}\`\n` +
                `**RAM:** \`${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}\` GB | **Usage:** \`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}\` MB \n`
        })
            .addFields({
                name: 'Music Stats:',
                value: `**Lavalink Nodes:** \`${client.manager.nodes.size}\`\n` +
                    `**Players:** \`${client.manager.players.size}\`\n`
            })

        await interaction.editReply({ embeds: [embed] });
    }
}

export default statuscommand;