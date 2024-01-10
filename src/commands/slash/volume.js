const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription("Change the volume")
        .setDMPermission(false)
        .addIntegerOption((option) => option
            .setName("volume")
            .setDescription("Set the volume")
            .setMinValue(0)
            .setMaxValue(100)),

    async execute(interaction, client) {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const player = client.manager.get(interaction.guild.id);
        const volume = interaction.options.getInteger("volume", false);

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                ephemeral: true,
            });
        }

        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
                ephemeral: true,
            });
        }

        if (interaction.member.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`It seems like you are not connected to the same voice channel as me`)],
                ephemeral: true,
            });
        }

        if (!volume) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription(`The current volume is **\`${player.volume}%\`**`)],
            });
        }

        player.setVolume(volume);
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription(`The volume has been set to **\`${volume}%\`**`)],
        });

    }
}