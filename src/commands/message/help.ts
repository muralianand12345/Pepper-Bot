import { EmbedBuilder } from "discord.js";

import { Command } from "../../types";
import { msToTime } from "../../utils/format";

const helpcommand: Command = {
    name: "help",
    description: "About Bot and Commands",
    cooldown: 5000,
    owner: false,
    premium: false,
    userPerms: [],
    botPerms: [],
    execute: async (client, message, args) => {

        const slashCommands = client.slashCommands.map(command => {
            return {
                name: command.data.name,
                description: command.data.description
            }
        });

        var embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`${client.user?.username} Commands`)
            .setThumbnail(client.user?.displayAvatarURL() || "")
            .setDescription(`**${client.user?.username}** is a music bot that is easy to use and setup. It plays music from Spotify, Apple Music, Soundcloud, and more!\n\n**[Invite ${client.user?.username}](https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands)** | **[Support Server](https://discord.gg/XzE9hSbsNb)** | **[Website](https://pepperbot.muralianand.in/)**\n**Prefix:** \`${client.config.bot.prefix}\`\n**Uptime:** \`${msToTime(client.uptime || 0)}\``)
            .addFields({ name: '__Slash Commands__', value: slashCommands.map(command => `**${command.name}** - ${command.description}`).join('\n') })
            .setTimestamp();

        if (!client.config.bot.disableMessage) {
            const msgCommands = client.commands.map(command => {
                return {
                    name: command.name,
                    description: command.description
                }
            });

            embed
                .setDescription(`**${client.user?.username}** is a music bot that is easy to use and setup. It plays music from Spotify, Apple Music, Soundcloud, and more!\n\n**[Invite ${client.user?.username}](https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands)** | **[Support Server](https://discord.gg/XzE9hSbsNb)** | **[Website](https://pepperbot.muralianand.in/)**\n**Prefix:** \`${client.config.bot.prefix}\`\n**Uptime:** \`${msToTime(client.uptime || 0)}\``)
                .addFields({ name: '__Message Commands__', value: msgCommands.map(command => `**${command.name}** - ${command.description}`).join('\n') });
        } else {
            embed.setDescription(`**${client.user?.username}** is a music bot that is easy to use and setup. It plays music from Spotify, Apple Music, Soundcloud, and more!\n\n**[Invite ${client.user?.username}](https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands)** | **[Support Server](https://discord.gg/XzE9hSbsNb)** | **[Website](https://pepperbot.muralianand.in/)**\n**Uptime:** \`${msToTime(client.uptime || 0)}\``);
        }
        await message.reply({ embeds: [embed] });
    }
}

export default helpcommand;