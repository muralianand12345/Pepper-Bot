import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

const volumecommand: SlashCommand = {
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

    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);
        const volume = interaction.options.getInteger("volume", false);

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
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

        if (!guildMember.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
                ephemeral: true,
            });
        }

        if (guildMember.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`It seems like you are not connected to the same voice channel as me`).setFooter({text: 'If you think there is an issue, kindly contact the server admin to use \`/dcbot\` command.'})],
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

export default volumecommand;