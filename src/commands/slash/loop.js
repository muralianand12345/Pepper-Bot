const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    cooldown: 5000,
    owner: false,
    premium: true,
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription("Loop the music")
        .setDMPermission(false)
        .addSubcommand((subcommand) => subcommand
            .setName("disable")
            .setDescription("Disable loop"))
        .addSubcommand((subcommand) => subcommand
            .setName("track")
            .setDescription("Loop the current track"))
        .addSubcommand((subcommand) => subcommand
            .setName("queue")
            .setDescription("Loop the queue")),

    async execute(interaction, client) {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const player = client.manager.get(interaction.guild.id);
        const mode = interaction.options.getSubcommand();

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music currently playing")],
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

        if (mode === "disable" && !player.queueRepeat && !player.trackRepeat) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Loop is already disabled")],
                ephemeral: true,
            });
        } else if (mode === "track" && player.trackRepeat) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Track loop is already enabled")],
                ephemeral: true,
            });
        } else if (mode === "queue" && player.queueRepeat) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Queue loop is already enabled")],
                ephemeral: true,
            });
        }

        switch (mode) {
            case "disable":
                player.setQueueRepeat(false);
                player.setTrackRepeat(false);
                break;
            case "track":
                player.setQueueRepeat(false);
                player.setTrackRepeat(true);
                break;
            case "queue":
                player.setQueueRepeat(true);
                player.setTrackRepeat(false);
                break;
        }

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(client.config.music.embedcolor)
                    .setDescription(`Loop is now **\`${mode === "disable" ? "disabled" : mode}\`**`)
            ]
        });
    }
}