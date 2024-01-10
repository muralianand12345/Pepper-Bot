const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription("Resume Music")
        .setDMPermission(false),
    async execute(interaction, client) {
        
        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const player = client.manager.get(interaction.guild.id);

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                ephemeral: true,
            });
        }

        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                ephemeral: true,
            });
        }

        if (interaction.member.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
                ephemeral: true,
            });
        }

        if (!player.paused) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("The music is already playing")],
                ephemeral: true,
            });
        }

        player.pause(false);
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("I resumed the music")],
        });
    }
}