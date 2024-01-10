const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

const { msToTime } = require('../../events/client/commands/functions/format.js');

module.exports = {
    cooldown: 10000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription("About Bot and Commands")
        .setDMPermission(true),
    async execute(interaction, client) {

        await interaction.deferReply();

        const msgCommands = client.messageCommands.map(command => {
            return {
                name: command.name,
                description: command.description
            }
        });

        const slashCommands = client.slashCommands.map(command => {
            return {
                name: command.data.name,
                description: command.data.description
            }
        });

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`${client.user.username} Commands`)
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`**${client.user.username}** is a music bot that is easy to use and setup. It plays music from Spotify, Apple Music, Soundcloud, and more!\n\n**[Invite ${client.user.username}](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands)** | **[Support Server](https://discord.gg/XzE9hSbsNb)** | **[Website](https://pepperbot.muralianand.in/)**\n**Prefix:** \`${client.config.bot.prefix}\`\n**Uptime:** \`${msToTime(client.uptime)}\``)
            .addFields({ name: '__Message Commands__', value: msgCommands.map(command => `**${command.name}** - ${command.description}`).join('\n') })
            .addFields({ name: '__Slash Commands__', value: slashCommands.map(command => `**${command.name}** - ${command.description}`).join('\n') })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    }
}