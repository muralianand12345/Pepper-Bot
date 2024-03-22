import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";
import { msToTime } from "../../utils/format";

const helpcommand: SlashCommand = {
    cooldown: 10000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription("About Bot and Commands")
        .setDMPermission(true),
    execute: async (interaction, client) => {

        await interaction.deferReply();

        const slashCommands = client.slashCommands.map(command => {
            return {
                name: command.data.name,
                description: command.data.description
            }
        });

        var embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`${client.user?.username} Commands`)
            .setThumbnail(client.user?.displayAvatarURL() || '')
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

        await interaction.editReply({ embeds: [embed] });
    }
}

export default helpcommand;