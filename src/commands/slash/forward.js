const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('forward')
        .setDescription("Forward a currently playing song")
        .setDMPermission(false)
        .addNumberOption(option => option
            .setName('seconds')
            .setDescription('How many seconds to forward?')
            .setRequired(true)
        ),
    async execute(interaction, client) {

        await interaction.deferReply({ ephemeral: false });
    
        const value = interaction.options.getNumber('seconds');
        const player = client.manager.get(interaction.guild.id);

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music currently playing")],
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

        if (value && !isNaN(value)) {
            if ((player.position + value * 1000) < player.queue.current.duration) {
                await player.seek(player.position + value * 1000);

                const embed = new EmbedBuilder()
                    .setDescription(`Muisc ${player.queue.current.title} has been forwarded to ${value} seconds`)
                    .setColor(client.color);
                return interaction.editReply({ embeds: [embed] });

            } else {
                return interaction.editReply('You cannot forward beyond the song duration')
            }
        } else {
            return interaction.editReply('Please enter a valid number of seconds to forward')
        }
    }
}