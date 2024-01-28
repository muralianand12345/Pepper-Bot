const {
    EmbedBuilder
} = require('discord.js');
const os = require('os');
const moment = require("moment");
require("moment-duration-format");
const prettyBytes = require("pretty-bytes");

const botStatsModal = require("../../events/database/modals/botDataAnalysis.js");

module.exports = {
    name: "botstats",
    description: "Get bot stats",
    cooldown: 1000,
    owner: true,
    userPerms: ['Administrator'],
    botPerms: ['Administrator'],
    async execute(client, message, args) {

        var embed = new EmbedBuilder()
            .setColor('Green')
            .setAuthor({ name: `${client.user.tag}`, iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 2048 }))
            .setTimestamp();

        var find = await botStatsModal.findOne({
            clientId: client.user.id
        });

        if (!find) return;

        const totalSeconds = os.uptime();
        const realTotalSecs = Math.floor(totalSeconds % 60);
        const days = Math.floor((totalSeconds % (31536 * 100)) / 86400);
        const hours = Math.floor((totalSeconds / 3600) % 24);
        const mins = Math.floor((totalSeconds / 60) % 60);

        embed.addFields({
            name: 'Bot Stats',
            value: `**Name:** \`${client.user.tag}\`\n` +
                `**ID:** \`${client.user.id}\`\n` +
                `**Uptime:** \`${days} days, ${hours} hours, ${mins} minutes, and ${realTotalSecs} seconds\`\n` +
                `**Host:** \`${os.type()} ${os.release()} (${os.arch()})\`\n` +
                `**CPU:** \`${os.cpus()[0].model}\` | **Load:** \`${(os.loadavg()[0]).toFixed(2)}%\` | **Cores:** \`${os.cpus().length}\`\n` +
                `**RAM:** \`${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}\` GB | **Usage:** \`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}\` MB \n`
        })
            .addFields({
                name: 'Bot Data Analysis',
                value: `**Guilds:** \`${client.guilds.cache.size}\`\n` +
                    `No. of restarts: \`${find.restartCount}\`\n` +
                    `No. of interactions: \`${find.interactionCount}\`\n` +
                    `No. of commands: \`${find.commandCount}\`\n` +
                    `No. of users: \`${client.guilds.cache.reduce((a, b) => a + b.memberCount, 0)}\`\n`
            })
            .addFields({ name: 'Lavalink Stats', value: `------------------` });

        client.manager.nodes.forEach((node) => {
            try {
                embed.addFields({
                    name: "Node Info",
                    value: `**Name:** \`${node.options.identifier}\`\n` +
                        `**Connected:** ${node.connected ? "Connected [🟢]" : "Disconnected [🔴]"}\n` +
                        `**Player:** \`${node.stats.players}\`\n` +
                        `**Used Players:** \`${node.stats.playingPlayers}\`\n` +
                        `**Uptime:** \`${moment.duration(node.stats.uptime).format("d [days], h [hours], m [minutes], s [seconds]")}\`\n` +
                        `**Cores:** \`${node.stats.cpu.cores}\` Core(s)\n` +
                        `**Memory Usage:** \`${prettyBytes(node.stats.memory.used)}/${prettyBytes(node.stats.memory.reservable)}\`\n` +
                        `**System Load:** \`${(Math.round(node.stats.cpu.systemLoad * 100) / 100).toFixed(2)}\`%\n` +
                        `**Lavalink Load:** \`${(Math.round(node.stats.cpu.lavalinkLoad * 100) / 100).toFixed(2)}\`%`
                });
            } catch (e) {
                console.log(e);
            }
        });

        await message.channel.send({ embeds: [embed] });


    }
}