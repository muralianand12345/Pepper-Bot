import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

const loopcommand: SlashCommand = {
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

    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);
        const mode = interaction.options.getSubcommand();

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music currently playing")],
                ephemeral: true,
            });
        }

        const guildMember = interaction.guild.members.cache.get(interaction.user.id);

        if (!guildMember) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Member not found")],
                ephemeral: true,
            });
        }

        if (guildMember.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me").setFooter({text: 'If you think there is an issue, kindly contact the server admin to use \`/dcbot\` command.'})],
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

export default loopcommand;