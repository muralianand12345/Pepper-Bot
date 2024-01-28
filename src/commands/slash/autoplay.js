const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');

module.exports = {
    cooldown: 1000,
    owner: false,
    premium: true,
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription("AutoPlay music")
        .setDMPermission(true),
    async execute(interaction, client) {

        if (!interaction.guild.members.me.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Permission to connect or speak in <#${interaction.member.voice.channel.id}> channel is required`)],
            });
        }

        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
                ephemeral: true,
            });
        }

        if (!interaction.member.voice.channel.joinable) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to join <#${interaction.member.voice.channel.id}> channel`)],
                ephemeral: true,
            });
        }

        if (!interaction.member.voice.channel.speakable) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to speak in <#${interaction.member.voice.channel.id}> channel`)],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);

        if (!player) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("I'm not connected to any voice channel!")],
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: false });

        const autoplay = player.get("autoplay");

        if (autoplay === true) {
            await player.set("autoplay", false);
            const embed = new EmbedBuilder()
                .setDescription(`Autoplay is now disabled`)
                .setColor('Red');
            return interaction.editReply({ embeds: [embed] });
        } else {
            await player.set("autoplay", true);
            const embed = new EmbedBuilder()
                .setDescription(`Autoplay is now enabled`)
                .setColor('Green');

            return interaction.editReply({ embeds: [embed] });
        }
    }
}